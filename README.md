# Dubai AI Broker Assistant

**An AI assistant that does a Dubai real-estate agent's admin work.** Part CRM, part
Claude-powered assistant, built as multi-tenant SaaS so many agencies can use one
deployment while each sees only its own data.

> **Live demo:** https://dubai-real-estate-ashy.vercel.app · `demo@demo.ae` / `demo12345`
> **API:** https://dubai-broker-api.onrender.com/health
>
> The API runs on a free Render instance that sleeps after 15 minutes idle — the
> first request after a quiet spell can take ~30 seconds.

| | |
|---|---|
| **Frontend** | Next.js 14 · TypeScript · Tailwind · Recharts · Leaflet · Framer Motion |
| **Backend** | FastAPI (async) · SQLAlchemy 2.0 · Pydantic v2 |
| **Database** | PostgreSQL (Supabase) · pgvector |
| **AI** | Anthropic Claude with tool-calling · RAG via pgvector + Voyage embeddings |
| **Voice** | Web Speech API (browser-side, no per-minute cost) |
| **Hosting** | Vercel (web) · Render (API) · Supabase (database) |

---

## The problem

A Dubai agent juggles six to eight disconnected tools — portals for listings,
spreadsheets for leads, WhatsApp for clients, Canva for marketing, a separate CRM —
and does the same work by hand every day: matching buyers to stock, writing pitches,
chasing follow-ups, tracking commission.

This puts all of it in one place, and hands the repetitive parts to Claude.

---

## Screenshots

### Dashboard

Live stats, a Dubai market map where circle size is inventory and colour is the
average price band, plus lead and inventory breakdowns.

![Dashboard](docs/screenshots/dashboard.png)

### Today — the follow-up engine

The page an agent opens each morning: exactly who to contact, ordered most-overdue
first. **This runs on rules, not AI — it costs zero tokens.** Claude is only called
when you press *Draft*.

![Today](docs/screenshots/today.png)

### Pipeline

Every lead from first contact to closed deal. All seven stages fit on screen and
wrap responsively rather than scrolling sideways.

![Pipeline](docs/screenshots/pipeline.png)

### AI Search — a chat that remembers

Plain-English search that calls real database tools — not a chatbot guessing at
listings. Conversations are saved, so "what about the 2-beds?" resolves against
what you asked three messages ago. The mic dictates straight into the box, and the
words appear while you're still speaking.

![AI Search](docs/screenshots/ai-search-voice.png)

### Listings

Inventory with photos. Import live Dubai listings from Bayut by area, or upload
your agency's own stock as CSV. Every card opens a full property page.

![Listings](docs/screenshots/listings.png)

### Property detail — with the agent's number

Full specs, amenities, description, and a contact card that dials, emails, or
opens WhatsApp with the enquiry already written. *Price in context* positions the
ask against recorded DLD sales, falling back to live asking prices when no
transactions are loaded — and says which one it used.

![Property detail](docs/screenshots/property-detail.png)

### Brokers list, admins verify

Agents submit their own stock. Nothing reaches search, the grid, or an AI answer
until an admin approves it — and a rejection has to carry a reason the broker can
act on.

![Verification queue](docs/screenshots/review-reject.png)

### Market Trends

Nine views of your inventory: price distribution, bedroom mix, price-per-sqft by
area, size-vs-price scatter, area comparison, and more.

![Market Trends](docs/screenshots/market.png)

### On a phone

The whole app works at 390px. Below `lg` the sidebar collapses behind a hamburger
drawer.

| Dashboard | Today | Property detail |
|---|---|---|
| ![Dashboard on mobile](docs/screenshots/dashboard-mobile.png) | ![Today on mobile](docs/screenshots/today-mobile.png) | ![Property detail on mobile](docs/screenshots/property-detail-mobile.png) |

---

## What it does

### CRM
- Agency signup, agent invites, roles (`admin` / `agent`), JWT auth
- Leads with full buyer requirements (budget, beds, type, preferred areas, language)
- Kanban pipeline: New → Contacted → Qualified → Viewing → Negotiation → Won / Lost
- Activity timeline per lead (call, WhatsApp, email, meeting, viewing, note)
- Tasks and reminders; deals with commission and payment tracking

### The AI brain

Claude runs an agentic tool loop over four tools and decides which to reach for.
Three hit SQL; only one is RAG — see [Why only one tool is RAG](#why-only-one-tool-is-rag).

| Tool | Backed by | Answers |
|---|---|---|
| `search_properties` | SQL over your inventory | "3 bed in Dubai Marina under 5M with a pool" |
| `market_check` | SQL aggregate over DLD transactions | "What's a 2-bed in JVC actually going for?" |
| `find_comparables` | SQL, nearest by area/beds/size | "Justify this asking price to my buyer" |
| `knowledge_lookup` | **RAG** — pgvector + Voyage embeddings | "What are the transfer costs for a non-resident?" |

Plus the task features built on the same client:

| Feature | What it does |
|---|---|
| **Match** | Ranks the best listings for a specific lead, with a reason per pick |
| **Pitch** | Writes a ready-to-send WhatsApp or email message **in the client's language** |
| **Marketing** | Portal listing, Instagram caption, ad variants, story script, email blast — returned as structured JSON |
| **Follow-up draft** | Short, on-demand nudge for a lead who's gone quiet |

**Chat with memory.** AI Search is a conversation, not a one-shot box. History is
replayed from the database, never from the request body — a client can't inject
turns the model will treat as its own prior statements.

**Voice input.** Dictation runs on the browser's Web Speech API, so it adds no
per-minute cost and doesn't depend on the Anthropic API being reachable. Interim
words render as ghost text while you speak. Where the API is unavailable the mic
isn't rendered at all — a control that does nothing is worse than no control.

### Inventory
- Bayut import via RapidAPI, filtered to the community you ask for, auto-deduped
- CSV upload for an agency's own listings, with a downloadable template
- ~2,000 synthetic Dubai listings seeded on first run so the app is usable immediately
- DLD transaction import (`python import_dld.py <csv>`), idempotent on DLD's own
  transaction id

### Broker listings & verification
- Agents submit stock at **My Listings**; everything lands `pending`, admins included
- Admins approve or reject at **Verify**, oldest first so the back of the queue
  isn't starved
- A rejection **requires a reason**, offered as one-tap presets — "rejected" with no
  explanation gives the broker nothing to act on
- Editing an approved listing returns it to the queue: an approval covers the
  content that was reviewed, not the row forever
- The moderation gate lives in `fetch_properties()`, so no endpoint and no AI tool
  can surface pending stock by forgetting a filter

### Analytics
- Dashboard: live stat tiles, Leaflet market map, lead trend, stage and type breakdowns
- Market Trends: price bands, bedroom mix, price/sqft by area, size-vs-price scatter,
  area radar, inventory treemap

---

## Architecture

```mermaid
flowchart LR
    subgraph clients [Clients]
        WEB["Next.js web app<br/>(Vercel)"]
        TG["Telegram bot<br/>(python-telegram-bot)"]
    end

    subgraph api ["FastAPI backend (Render)"]
        ROUTES["Routers<br/>auth · leads · pipeline · tasks<br/>deals · analytics · briefing · ai"]
        BRAIN["Claude brain<br/>manual tool-use loop"]
        GUARD["Guards<br/>JWT · tenant scope · rate limit"]
    end

    DB[("PostgreSQL<br/>Supabase")]
    ANTHROPIC["Anthropic API<br/>Claude"]
    BAYUT["RapidAPI<br/>Bayut listings"]

    WEB -- "REST + JWT" --> ROUTES
    TG  -- "REST + JWT" --> ROUTES
    ROUTES --> GUARD
    GUARD --> DB
    ROUTES --> BRAIN
    BRAIN -- "tool calls hit the DB" --> DB
    BRAIN <--> ANTHROPIC
    ROUTES --> BAYUT
```

**Multi-tenancy:** every tenant-owned row carries `agency_id`, and every route is
scoped to the authenticated user's agency. Shared-pool listings use
`agency_id = NULL` so all tenants can see baseline inventory.

> ⚠️ Isolation is currently **application-level only**. There is no Postgres
> Row-Level Security, so one missed filter in a future route would leak data across
> agencies. See [Known gaps](#known-gaps).

### How an AI search actually runs

The model never invents listings — it calls a real database function whose results
are already restricted to the caller's agency.

```mermaid
sequenceDiagram
    participant A as Agent
    participant F as Next.js
    participant API as FastAPI
    participant C as Claude
    participant DB as Postgres

    A->>F: "3 bed in Dubai Marina under 5M with a pool"
    F->>API: POST /api/ai/search (JWT)
    API->>API: verify JWT, resolve agency_id, check rate limit
    API->>C: messages + search_properties tool
    C-->>API: tool_use { location, max_price, min_bedrooms, require_pool }
    API->>DB: SELECT ... WHERE agency_id = ? OR agency_id IS NULL
    DB-->>API: matching rows
    API->>C: tool_result (listings)
    C-->>API: ranked answer with reasoning
    API-->>F: { answer, properties[] }
    F-->>A: explanation + property cards
```

### Why only one tool is RAG

RAG is the default answer to "add knowledge to an LLM", and for three of these four
tools it would be the wrong one. **Retrieval cannot aggregate.**

Ask "what's the median price per sqft for a 2-bed in JVC?" against 5,000 DLD
transactions. A vector search returns the ~20 chunks most similar to the question,
the model averages those, and reports the result as *the market rate* — fluently,
with no signal that it saw 0.4% of the data. Numeric predicates degrade the same
way: "under 2M" becomes a similarity score rather than a filter, and counting is
meaningless. The failure is silent and confident, which is the worst kind.

So market questions run as deterministic SQL — `market_check` and `find_comparables`
compute over every matching row, and use the **median** rather than the mean because
one Palm villa drags an average across a whole community.

RAG earns its place on exactly one surface: the knowledge base, where answers are
prose, there is nothing to aggregate, and the signal genuinely is semantic —
"transfer costs" should find a document that says "DLD registration fee" without
sharing a keyword.

```mermaid
flowchart TD
    Q["Agent's question"] --> C{"Claude picks a tool"}
    C -->|"inventory"| S["search_properties<br/>SQL · tenant-scoped"]
    C -->|"what's it worth?"| M["market_check<br/>SQL aggregate over DLD"]
    C -->|"justify the price"| P["find_comparables<br/>SQL · nearest sales"]
    C -->|"how does X work?"| K["knowledge_lookup<br/>RAG · pgvector"]
    S --> A["Grounded answer"]
    M --> A
    P --> A
    K --> A

    why["Aggregates and filters must be exact,<br/>so they are SQL. Only prose is retrieved."]
    K -.- why
```

When the knowledge base is unavailable, the tool returns a message that explicitly
forbids answering from memory — an early version cheerfully volunteered "I know the
standard fee structure is…", which is precisely the behaviour a grounded system
exists to prevent.

### Lead lifecycle

```mermaid
stateDiagram-v2
    [*] --> New: web form · Telegram · manual
    New --> Contacted: first outreach
    Contacted --> Qualified: budget + needs confirmed
    Qualified --> Viewing: shortlist sent, viewing booked
    Viewing --> Negotiation: offer made
    Negotiation --> Won: deal closed
    Negotiation --> Lost: fell through
    Won --> [*]
    Lost --> [*]

    note right of Contacted
        The follow-up engine watches
        time since last touch per stage
        (New 1d, Contacted 2d, Qualified 3d)
        and surfaces stale leads on Today.
    end note
```

### Data model

```mermaid
erDiagram
    AGENCIES ||--o{ USERS : employs
    AGENCIES ||--o{ LEADS : owns
    AGENCIES ||--o{ PROPERTIES : "owns (NULL = shared pool)"
    AGENCIES ||--o{ DEALS : records
    LEADS    ||--o{ INTERACTIONS : "timeline"
    LEADS    ||--o{ TASKS : "follow-ups"
    LEADS    ||--o{ DEALS : "converts to"
    USERS    ||--o{ LEADS : "assigned"
    USERS    ||--o{ PROPERTIES : "submits for review"
    USERS    ||--o{ CONVERSATIONS : "chats"
    PROPERTIES ||--o{ DEALS : "sold in"
    CONVERSATIONS ||--o{ CHAT_MESSAGES : "turns"

    AGENCIES { int id PK
               string name
               string slug }
    USERS    { int id PK
               int agency_id FK
               string email
               string role
               string phone "shown on their listings" }
    LEADS    { int id PK
               int agency_id FK
               string status
               int score
               numeric budget_max
               string preferred_locations }
    PROPERTIES { int id PK
               int agency_id FK "NULL = shared"
               string location
               numeric price
               string source "seed|bayut|csv|manual|broker"
               string status "pending|approved|rejected"
               int listed_by_id FK "submitting agent"
               string rejection_reason }
    CONVERSATIONS { int id PK
               int user_id FK
               string title }
    CHAT_MESSAGES { int id PK
               int conversation_id FK
               string role "user|assistant"
               text content }
    DLD_TRANSACTIONS { int id PK
               string area
               numeric price_aed
               numeric price_per_sqft
               date transaction_date }
    KNOWLEDGE_CHUNKS { int id PK
               int agency_id FK "NULL = global"
               text content
               vector embedding "512-dim" }
    INTERACTIONS { int id PK
               int lead_id FK
               string channel
               string body }
    TASKS    { int id PK
               int lead_id FK
               datetime due_at
               bool done }
    DEALS    { int id PK
               int lead_id FK
               numeric value
               numeric commission
               string stage }
```

---

## Repository layout

```
dubai-real-estate/
├─ backend/                  FastAPI + Claude + DB
│  ├─ app/
│  │  ├─ main.py             app factory, routers, startup guards
│  │  ├─ config.py           settings + production safety checks
│  │  ├─ db.py               async engine, pooling (Supabase-pooler safe)
│  │  ├─ models.py           Agency, User, Property, Lead, Interaction, Task,
│  │  │                      Deal, Conversation, ChatMessage, DldTransaction
│  │  ├─ security.py         bcrypt + JWT
│  │  ├─ ratelimit.py        per-agency AI spend guard
│  │  ├─ seed.py             demo agency + ~2,000 tiered-price listings
│  │  ├─ ai/
│  │  │  ├─ client.py        Anthropic client, tool-use loop, prompt caching
│  │  │  ├─ broker_agent.py  tool defs + the moderation gate on every read
│  │  │  ├─ market.py        DLD aggregates (SQL, not RAG — and why)
│  │  │  └─ knowledge.py     pgvector RAG: embed · search · format
│  │  ├─ integrations/bayut.py
│  │  └─ api/                auth, properties, listings, leads, pipeline,
│  │                         tasks, deals, analytics, briefing, ai, chat, health
│  ├─ import_dld.py          load Dubai Pulse transaction CSVs (idempotent)
│  ├─ seed_knowledge.py      embed the starter knowledge base
│  ├─ Dockerfile · Procfile · requirements.txt
├─ frontend/                 Next.js 14 App Router
│  ├─ app/
│  │  ├─ page.tsx            landing
│  │  ├─ login/
│  │  └─ (app)/              protected: today, dashboard, pipeline,
│  │                         leads/[id], search, market,
│  │                         listings + listings/[id],
│  │                         my-listings (+ new, [id]/edit), review
│  ├─ components/            Sidebar, PropertyCard, ListingForm, Markdown,
│  │                         ui/*, dashboard/*, market/*
│  └─ lib/
│     ├─ api.ts              typed fetch wrapper, auto-logout on 401
│     ├─ use-speech.ts       Web Speech API hook (dictation)
│     └─ viz.ts              validated chart colour tokens
├─ telegram_bot/             Telegram front-end
├─ docs/                     setup guides + screenshots
├─ render.yaml               Render blueprint for the API
├─ DEPLOY.md                 full deployment walkthrough
└─ PLAN.md · PROJECT_OVERVIEW.md
```

---

## API reference

```
Auth       POST /api/auth/signup · /login   GET /api/auth/me · /users
           POST /api/auth/invite
Properties GET|POST /api/properties        GET /api/properties/{id}
           POST /api/properties/import/bayut
           POST /api/properties/import/csv  GET …/import/csv/template
Listings   POST /api/listings               GET /api/listings/mine
           GET  /api/listings/{id}          GET /api/listings/{id}/market
           PATCH|DELETE /api/listings/{id}
           GET  /api/listings/review/queue  GET /api/listings/review/counts
           POST /api/listings/{id}/review   (admin: approve / reject + reason)
Chat       GET  /api/chat/conversations     GET /api/chat/conversations/{id}
           POST /api/chat/conversations/{id}/messages   (id=0 starts one)
           PATCH|DELETE /api/chat/conversations/{id}
Leads      GET|POST /api/leads             GET|PATCH|DELETE /api/leads/{id}
           GET|POST /api/leads/{id}/interactions
Pipeline   GET  /api/pipeline
Tasks      GET|POST /api/tasks             PATCH|DELETE /api/tasks/{id}
           POST /api/tasks/{id}/done
Deals      GET|POST /api/deals             GET /api/deals/summary
           PATCH|DELETE /api/deals/{id}
Analytics  GET  /api/analytics/dashboard   GET /api/analytics/market
Briefing   GET  /api/briefing/today        (rule-based, zero AI cost)
AI         POST /api/ai/search · /match · /pitch · /marketing · /followup
Health     GET  /health (liveness)         GET /health/ready (DB check)
```

Interactive docs at `/docs` when `ENABLE_DOCS=true`.

---

## Running locally

**Prerequisites:** Python 3.12+, Node 18+, an [Anthropic API key](https://console.anthropic.com/settings/keys).

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
Copy-Item .env.example .env           # then edit .env
uvicorn app.main:app --reload --port 8000
```

The only two values you must set in `.env` are `DATABASE_URL` (SQLite works out of
the box) and `ANTHROPIC_API_KEY`. First boot creates the tables, seeds the demo
agency and ~2,000 listings, and serves docs at http://localhost:8000/docs.

### Frontend

```powershell
cd frontend
npm install
Copy-Item .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                               # http://localhost:3000
```

Sign in with `demo@demo.ae` / `demo12345`.

### Telegram bot (optional)

```powershell
cd telegram_bot
pip install -r requirements.txt
# .env: TELEGRAM_BOT_TOKEN from @BotFather
python bot.py
```

---

## Deployment

Three services. **Vercel hosts the frontend only** — FastAPI is a long-lived process
with a database connection pool, so it needs a container host.

```mermaid
flowchart LR
    U(["Agent's browser"]) -->|HTTPS| V["Vercel<br/>Next.js frontend"]
    V -->|"REST + JWT<br/>NEXT_PUBLIC_API_URL"| R["Render<br/>FastAPI API"]
    R -->|"asyncpg via session pooler"| S[("Supabase<br/>PostgreSQL")]
    R -->|HTTPS| AN["Anthropic API"]
    R -->|HTTPS| BY["RapidAPI Bayut"]
```

Deploy in this order — each step needs a value from the one before. Full
walkthrough with troubleshooting in **[DEPLOY.md](DEPLOY.md)**.

### 1. Database — Supabase

Create a project, then copy the **Session pooler** connection string
(Settings → Database → Connection string).

> ⚠️ Two things change together when you switch to the pooler, and missing either
> one is the most common setup failure:
>
> | | Host | Username |
> |---|---|---|
> | ❌ Direct | `db.<ref>.supabase.co` — **IPv6-only**, unreachable from Render | `postgres` |
> | ✅ Session pooler | `aws-<n>-<region>.pooler.supabase.com:5432` | `postgres.<project-ref>` |
>
> The `aws-<n>` prefix is `aws-0` or `aws-1` depending on when the project was
> created. Copy the string from the dashboard rather than assembling it by hand.

### 2. API — Render

[`render.yaml`](render.yaml) is a blueprint: **New → Blueprint → select this repo**.
It provisions the service with production env vars already set and prompts for the
three secrets that can't live in git.

| Variable | Value |
|---|---|
| `ENVIRONMENT` | `production` — turns on the startup safety checks |
| `DATABASE_URL` | Supabase **pooler** string from step 1 |
| `ANTHROPIC_API_KEY` | your key |
| `SECRET_KEY` | generated automatically by Render |
| `CORS_ORIGINS` | your Vercel URL (set after step 3) |
| `SEED_DEMO_DATA` | `false` — keeps 2,000 fake listings out of a real database |
| `RAPIDAPI_KEY` | optional, only for Bayut imports |

With `ENVIRONMENT=production` the app **refuses to start** if the secret key is the
shipped default, the database is SQLite, CORS is empty or `*`, or debug is on — a
failed boot is cheaper than forged tokens or a database that vanishes on redeploy.

Health check path: `/health`.

### 3. Frontend — Vercel

- **Root Directory: `frontend`** ← easy to miss, and nothing works without it
- Environment variable: `NEXT_PUBLIC_API_URL` = your Render URL, no trailing slash

`NEXT_PUBLIC_*` values are **inlined at build time**, so changing this later requires
a redeploy, not just a save.

### 4. Connect them

Copy the Vercel URL into `CORS_ORIGINS` on Render and redeploy the API. Then verify:

```bash
curl https://your-api.onrender.com/health/ready
# {"status":"ready","database":"connected","properties":2000}
```

Sign up an agency from the deployed frontend — a successful signup proves CORS,
the database, and the API URL are all wired correctly.

---

## Cost control

The AI bill is designed down, not discovered later:

| Guard | Default | Setting |
|---|---|---|
| Model | Haiku (cheapest capable) | `CLAUDE_MODEL` |
| Extended thinking | off | `USE_THINKING` |
| Output cap | 1,500 tokens | `AI_MAX_TOKENS` |
| Rate limit | 15 requests/min **per agency** | `AI_RATE_LIMIT_PER_MINUTE` |

The Today briefing — the most-used page — is **100% rule-based and spends no
tokens**. AI runs only when an agent explicitly asks for a draft, match, pitch, or
marketing pack. Voice dictation runs in the browser, so it adds nothing per minute.

**On prompt caching — measured, not assumed.** The cacheable prefix here (system
prompt + four tool definitions) is ~1,300 tokens. Haiku 4.5 requires **4,096** before
a cache write is allowed, so caching *does not activate at this size* — the code
checks the model's minimum and refuses to mark a prefix that won't cache, rather
than paying the write premium for nothing. Measuring also showed output is 51–92% of
the cost of a typical request, so input caching was never the lever it looked like.
The plumbing is in place and switches on automatically on a model with a lower
threshold, or once the prompt grows past it.

---

## Design notes

**Chart colour is computed, not chosen.** Every value in
[`frontend/lib/viz.ts`](frontend/lib/viz.ts) was validated against the app's actual
chart surface for colour-vision-deficiency separation, lightness band, and contrast.
Three scales, three jobs, never mixed:

- **Series** (identity) — one colour when a chart shows one measure
- **Ordinal** (order) — a single-hue ramp that deepens along the pipeline or price bands
- **Status** (state) — reserved green/red for Won/Lost

Green vs red measures ΔE 4.1 under deuteranopia — effectively identical for
red-green colourblind readers — so Won/Lost **always carry an icon and a text
label**. Colour only reinforces.

---

## Known gaps

Honest limitations, not oversights:

- **Nothing sends.** Pitches and marketing copy are copy-to-clipboard. WhatsApp and
  email delivery are the next milestone.
- **No Row-Level Security.** Tenant isolation is enforced in application queries
  only. Postgres RLS is the next hardening step.
- **No automated test suite in CI.** Features are verified before commit — the
  listing flow ships with 28 API assertions over the full
  submit → hide → reject → approve → edit cycle and 36 browser assertions at 390px
  and 1440px — but nothing runs those on push yet.
- **`alembic/versions/` is empty.** `AUTO_CREATE_TABLES` creates tables but never
  alters them, so the listing columns went in as a hand-written `ALTER TABLE` pass.
  That worked once; it isn't a migration story.
- **The knowledge base is unvetted.** The starter chunks in `seed_knowledge.py` are
  placeholders. Every fee and threshold must be replaced with an auditable source
  before anyone relies on an answer.
- **DLD data isn't bundled.** Dubai Pulse requires a signed-in download, so
  `import_dld.py` is there but the table ships empty — which is why *Price in
  context* currently falls back to asking prices and says so.
- **Rate limiting is in-memory and per worker.** Accurate limits need Redis.
- **Deals and tasks have no UI.** The APIs exist; only the backend is wired.
- **The demo account is public.** `demo@demo.ae` / `demo12345` must be removed
  before any real agency uses this.

---

## Roadmap

**Next** — outreach delivery (Telegram push, then WhatsApp Business API), email
integration, RLS, a real Alembic migration chain, photo upload for broker listings
(currently a URL field), and CI running the assertion suites above.

**Later** — AI lead scoring, viewing scheduler with calendar sync, document
generation, Stripe billing and per-agency branding, Arabic RTL support — and Arabic
dictation, which the Web Speech API already supports by passing a different locale.

---

*Built with FastAPI, Next.js, and Claude — for the Dubai real-estate market.*
