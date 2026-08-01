# The AI brain — architecture, RAG rationale, and cost

## What it is

Claude with **four tools**, driven by a hand-written agentic loop
([`app/ai/client.py`](../backend/app/ai/client.py)). Not a chatbot over a
vector store — the model chooses *filters*, and Postgres computes *answers*.

| Tool | Backed by | Answers |
|---|---|---|
| `search_properties` | SQL over `properties` | "Find me 2-beds in Marina under 3M" |
| `market_check` | SQL aggregation over `dld_transactions` | "What are 2-beds in Marina actually worth? Trending?" |
| `find_comparables` | SQL over `dld_transactions` | "What did similar units sell for?" — the evidence |
| `knowledge_lookup` | **RAG** — pgvector + Voyage embeddings | "What fees on a 2M off-plan purchase?" |

The model can chain them. *"Is 2.4M fair for a 1200 sqft 2-bed in Marina?"*
triggers `market_check` for the price level **and** `find_comparables` for the
proof, in one turn — verified in testing.

---

## Why RAG for knowledge and SQL for market data

The single most consequential decision here, and it goes **against** the
instinct to put RAG everywhere.

### RAG cannot aggregate — so it must not touch DLD data

DLD transactions are structured rows: date, area, type, rooms, size, price. The
questions agents ask are aggregate: *average*, *median*, *how many*, *trend*.

Retrieval-augmented generation answers by embedding the question, pulling the
top-k most similar chunks, and letting the model read them. Applied to 5,000
transactions:

- It retrieves maybe 20 and averages **those**, presenting the result as the
  market average. The other 4,980 rows were never looked at.
- The answer is wrong, and **wrong confidently** — nothing in the output
  signals that it's a biased sample of 0.4% of the data.
- `"under 3M"` is an exact predicate. Embedding similarity has no notion of
  less-than.
- *"How many sold last quarter"* has no meaning in a top-k retrieval at all.

`SELECT percentile_cont(0.5) ... GROUP BY month` returns the correct number in
milliseconds. **A broker quoting a hallucinated price to a client is the worst
failure this product can have**, so market data is deterministic SQL and the
model never does arithmetic in its head.

### RAG earns its place on the knowledge base

The mirror image. *"What fees does a buyer pay on a 2M off-plan purchase?"* has
no columns to filter on — the answer is a paragraph in a policy document, and
the useful signal is semantic: a broker asking about *"transfer costs"* should
find a passage titled *"DLD registration fee"* even though no word matches.
`LIKE '%transfer costs%'` fails at exactly that; embeddings are built for it.

And the failure mode that makes RAG dangerous for numbers is **absent here** —
nobody needs the model to average the knowledge base. Top-k retrieval over
documents is a complete answer, not a biased sample of one.

| | Market data | Knowledge base |
|---|---|---|
| Shape | Structured rows | Prose |
| Question | Aggregate / numeric | "What's the rule?" |
| Right tool | **SQL** | **RAG** |
| RAG failure if misapplied | Silently wrong averages | — |

### RAG implementation notes

- **pgvector in the same Postgres** — no extra service, nothing to keep in
  sync, and retrieval filters by `agency_id` in the same query, so one tenant's
  private notes can never surface for another. Isolation is in the SQL
  predicate, not the prompt.
- **Voyage `voyage-3-lite`**, 512 dims. Claude has no embedding endpoint;
  Voyage is Anthropic's recommended provider. Documents and queries are
  embedded with different `input_type` values — mismatching them measurably
  degrades retrieval.
- **Low-scoring hits are dropped** (`min_score=0.35`). Vector search always
  returns its top-k even when nothing is relevant, and a model handed three
  unrelated passages will try to use them.
- **Chunks carry titles and sources** so answers can cite where a figure came
  from.

---

## Prompt caching — measured, and why it isn't your lever yet

Caching is wired ([`client.py`](../backend/app/ai/client.py)) but **gated**: it
only marks the prefix when that prefix actually exceeds the model's minimum. A
`cache_control` marker on a shorter prefix is **silently ignored** — no error,
no cache entry, `cache_creation_input_tokens` stays 0. Code that looks like it
caches but doesn't is worse than code that admits it can't.

Measured on this codebase:

| | Tokens |
|---|---|
| System prompt alone | 96 |
| System + 1 tool (before this work) | 917 |
| System + 4 tools (now) | ~1,341 |
| **Minimum on `claude-haiku-4-5`** | **4,096** |

**So caching does not activate on Haiku, even with four tools.** The minimum is
model-specific and not monotonic:

| Model | Minimum | Would cache? |
|---|---:|---|
| `claude-opus-5` | 512 | ✅ |
| `claude-opus-4-8` / `claude-sonnet-5` | 1024 | ✅ |
| `claude-opus-4-7` | 2048 | ❌ |
| **`claude-haiku-4-5`** (current) | **4096** | ❌ |

### And the saving would be small anyway

Measured cost per operation on Haiku (real API calls):

| Operation | Input | Output | Cost | Output share |
|---|---:|---:|---:|---:|
| AI search | 2,622 | 547 | $0.0054 | 51% |
| Match lead | 1,041 | 406 | $0.0031 | 66% |
| WhatsApp pitch | 397 | 228 | $0.0015 | 74% |
| Marketing pack | 255 | 573 | $0.0031 | **92%** |

**Output dominates** — and caching only affects input. Caching 1,341 of 2,622
input tokens on search saves ~$0.0012 per call. At 10,000 searches/month that's
**~$12/month**.

The honest read: at ~1.3¢ for a full lead workflow, **cost is not currently a
problem worth engineering around**. The gate is in place so caching switches on
automatically the moment you move to a model with a lower minimum, or the
prefix grows. If you want a real lever, it's output tokens — `AI_MAX_TOKENS`
and prompt concision, especially on the marketing pack.

---

## Loading DLD data

⚠️ **Dubai Pulse is UAE-geo-restricted.** From outside the region the hostname
resolves but TCP port 443 never connects, and access requires a registered
account. There is no unattended fetch — you download the export, the importer
loads it.

```powershell
# 1. dubaipulse.gov.ae -> sign in (free) -> Dubai Land Department -> "Transactions" -> CSV
# 2. Load it
cd backend
python import_dld.py path/to/Transactions.csv --limit 100000
```

The importer is **idempotent** (`ON CONFLICT DO NOTHING` on DLD's transaction
id), so dropping a fresh monthly export over the top only adds new rows. Column
mapping tolerates the header spellings seen across different exports.

Rows missing a date, price, or area are skipped and counted rather than
imported as nulls.

### Keeping it current

Re-run monthly with a fresh export. The `market_check` tool always filters to a
rolling window (default 12 months), so newly loaded rows change the answer with
no code change.

---

## Loading the knowledge base

```powershell
# Requires VOYAGE_API_KEY (voyageai.com)
cd backend
python seed_knowledge.py                 # built-in starter set
python seed_knowledge.py --dir ./my-docs # your own .md / .txt files
```

⚠️ **The built-in chunks are a starter set, not vetted reference material.**
They reflect widely-published Dubai practice and exist so the retrieval path is
testable end to end. Fees, thresholds, and procedures are set by DLD/RERA and
**do change**. Replace them with your own vetted documents before this is used
by a real agency, and keep `source` pointing at something auditable.

Without `VOYAGE_API_KEY` the tool reports itself unavailable and explicitly
instructs the model **not** to substitute figures from memory — without that
instruction it was observed answering *"I know the standard structure is…"* and
listing amounts it had never looked up.

---

## A bug this work fixed

`_thinking_kwargs()` unconditionally sent `thinking: {"type": "adaptive"}`.
That shape is only valid on 4.6-era and newer models — `claude-haiku-4-5`
(the configured default) rejects it. Setting `USE_THINKING=true` would have
returned a 400 on every AI call. It was dormant only because the default is
`false`. The mode is now chosen from the configured model.
