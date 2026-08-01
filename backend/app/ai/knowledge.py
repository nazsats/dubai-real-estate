"""RAG over the broker knowledge base — the one place retrieval is the right tool.

WHY RAG HERE (AND NOT FOR MARKET DATA)
--------------------------------------
`market.py` argues at length that DLD transactions must be SQL, because the
questions are aggregate and numeric. This module is the mirror image, and the
distinction is worth stating precisely, because "add RAG" applied to the wrong
data is how teams ship confidently-wrong numbers.

Use SQL when the data is rows and the question is arithmetic:
    "average price/sqft for 2-beds in Marina"  -> AVG() over every matching row

Use RAG when the answer lives in prose and you cannot enumerate the fields:
    "what fees does a buyer pay on a 2M off-plan purchase?"
    "how long does an Oqood registration take?"
    "does my client qualify for a golden visa at 1.8M?"

Those have no columns to filter on. The answer is a paragraph in a policy
document, and the useful retrieval signal is semantic — a broker asking about
"transfer costs" should find a passage titled "DLD registration fee" even
though the words differ. That is exactly what embeddings are for, and exactly
what `LIKE '%transfer costs%'` fails at.

The failure mode that makes RAG dangerous for numbers is absent here: nobody
needs the model to average the knowledge base. Top-k retrieval over documents
is a complete answer, not a biased sample of one.

DESIGN
------
* pgvector in the same Postgres — no extra service, no sync problem, and the
  retrieval can be filtered by `agency_id` in the same query, so a tenant's
  private notes never surface for another tenant.
* Embeddings come from Voyage (Anthropic's recommended embedding provider);
  Claude has no embedding endpoint of its own.
* Chunks are small and titled. A retrieved chunk is shown to the model *with*
  its source title, so answers can cite where they came from — a broker
  repeating a fee figure to a client needs to know which document said it.
* Retrieval is a tool, not an always-on prefix. Stuffing the knowledge base
  into every request would cost more and dilute unrelated queries.
"""
import os

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings

# voyage-3-lite: 512 dimensions, cheap, strong on retrieval. The dimension is
# baked into the column type, so changing model means a migration + re-embed.
EMBED_MODEL = "voyage-3-lite"
EMBED_DIM = 512
VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"


class EmbeddingUnavailable(RuntimeError):
    """Raised when no embedding provider is configured.

    Surfaced to the agent as a plain tool error rather than a crash — the rest
    of the brain keeps working without the knowledge base.
    """


async def embed(texts: list[str], *, input_type: str = "document") -> list[list[float]]:
    """Embed a batch of strings.

    `input_type` matters: Voyage embeds queries and documents into the same
    space but with different prefixes, and mismatching them measurably degrades
    retrieval. Documents are embedded at write time, queries at read time.
    """
    key = get_settings().voyage_api_key or os.getenv("VOYAGE_API_KEY", "")
    if not key:
        raise EmbeddingUnavailable(
            "VOYAGE_API_KEY is not set — the knowledge base cannot embed or search. "
            "Get a key at voyageai.com and add it to the backend environment."
        )
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            VOYAGE_URL,
            headers={"Authorization": f"Bearer {key}"},
            json={"model": EMBED_MODEL, "input": texts, "input_type": input_type},
        )
        resp.raise_for_status()
        data = resp.json()["data"]
    # Voyage does not guarantee response order matches input order.
    return [d["embedding"] for d in sorted(data, key=lambda d: d["index"])]


async def ensure_schema(session: AsyncSession) -> None:
    """Create the pgvector extension, table, and index if absent.

    Kept as raw DDL rather than a SQLAlchemy model because the `vector` type
    isn't in core SQLAlchemy and this table is only ever touched through the
    two functions below.
    """
    await session.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    await session.execute(
        text(
            f"""
            CREATE TABLE IF NOT EXISTS knowledge_chunks (
                id          bigserial PRIMARY KEY,
                agency_id   integer REFERENCES agencies(id) ON DELETE CASCADE,
                title       varchar(300) NOT NULL,
                source      varchar(300),
                content     text NOT NULL,
                embedding   vector({EMBED_DIM}) NOT NULL,
                created_at  timestamptz DEFAULT now()
            )
            """
        )
    )
    # IVFFlat needs training data to be worth building; on a small corpus a
    # sequential scan is faster anyway. Build it once the table is populated.
    await session.execute(
        text(
            "CREATE INDEX IF NOT EXISTS knowledge_chunks_agency_idx "
            "ON knowledge_chunks (agency_id)"
        )
    )
    await session.commit()


async def add_chunks(
    session: AsyncSession,
    chunks: list[dict],
    *,
    agency_id: int | None = None,
) -> int:
    """Embed and store chunks. `agency_id=None` means shared/global knowledge.

    Each chunk: {"title": str, "content": str, "source": str | None}
    """
    if not chunks:
        return 0
    vectors = await embed([f"{c['title']}\n\n{c['content']}" for c in chunks], input_type="document")
    for chunk, vec in zip(chunks, vectors):
        await session.execute(
            text(
                "INSERT INTO knowledge_chunks (agency_id, title, source, content, embedding) "
                "VALUES (:agency_id, :title, :source, :content, :embedding)"
            ),
            {
                "agency_id": agency_id,
                "title": chunk["title"],
                "source": chunk.get("source"),
                "content": chunk["content"],
                "embedding": str(vec),  # pgvector accepts the '[1,2,3]' literal form
            },
        )
    await session.commit()
    return len(chunks)


async def search_knowledge(
    session: AsyncSession,
    query: str,
    *,
    agency_id: int | None = None,
    limit: int = 4,
) -> list[dict]:
    """Semantic search. Returns shared knowledge plus this agency's own notes.

    Tenant isolation is in the SQL predicate, not the prompt — an agency can
    never retrieve another agency's private documents, regardless of what the
    model asks for.
    """
    (vector,) = await embed([query], input_type="query")
    rows = (
        await session.execute(
            text(
                """
                SELECT title, source, content,
                       1 - (embedding <=> CAST(:q AS vector)) AS score
                FROM knowledge_chunks
                WHERE agency_id IS NULL OR agency_id = :agency_id
                ORDER BY embedding <=> CAST(:q AS vector)
                LIMIT :limit
                """
            ),
            {"q": str(vector), "agency_id": agency_id, "limit": limit},
        )
    ).mappings().all()
    return [dict(r) for r in rows]


def format_knowledge(rows: list[dict], *, min_score: float = 0.35) -> str:
    """Render retrieved passages with their titles so answers can cite a source.

    Low-scoring hits are dropped rather than passed through: vector search
    always returns its top-k, even when nothing in the corpus is relevant, and
    a model handed three unrelated passages will try to use them.
    """
    keep = [r for r in rows if (r.get("score") or 0) >= min_score]
    if not keep:
        return (
            "Nothing in the knowledge base covers that. Say so plainly rather than "
            "guessing — do not invent fees, timelines, or regulatory thresholds."
        )
    out = ["Relevant knowledge-base passages (cite the title when you use one):"]
    for r in keep:
        src = f" — {r['source']}" if r.get("source") else ""
        out.append(f"\n### {r['title']}{src}\n{r['content'].strip()}")
    return "\n".join(out)
