# Dubai AI Broker Assistant — Backend

FastAPI + async SQLAlchemy (Postgres) + Anthropic Claude. This is the Phase 0 + Phase 2
foundation: project structure, a multi-tenant data model, and the Claude-powered broker
brain (search, match, pitch, marketing). See `../PLAN.md` for the full roadmap.

## Setup

1. **Python 3.11+** and a running **PostgreSQL** database.
2. Create the DB (once):
   ```sql
   CREATE DATABASE dubai_broker;
   ```
3. Install deps:
   ```bash
   cd backend
   python -m venv .venv
   # Windows:  .venv\Scripts\activate
   # macOS/Linux:  source .venv/bin/activate
   pip install -r requirements.txt
   ```
4. Configure env:
   ```bash
   cp .env.example .env   # then edit DATABASE_URL and ANTHROPIC_API_KEY
   ```
5. Run:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   On first boot it creates tables and seeds ~2,000 demo properties.
   Open the interactive API docs at **http://localhost:8000/docs**.

## Auth

Almost every route requires a **Bearer token**. Get one by signing up an agency,
or use the seeded demo login:

- **Demo login:** `demo@demo.ae` / `demo12345` (admin of the "Demo Realty" agency).

```bash
# Sign up a new agency (creates the first admin + returns a token)
curl -X POST localhost:8000/api/auth/signup -H "content-type: application/json" \
  -d '{"agency_name":"Skyline Realty","full_name":"Sara","email":"sara@skyline.ae","password":"secret123"}'

# Or log in
curl -X POST localhost:8000/api/auth/login -H "content-type: application/json" \
  -d '{"email":"demo@demo.ae","password":"demo12345"}'
# => {"access_token":"<JWT>","token_type":"bearer"}
```

Pass the token on every other call: `-H "Authorization: Bearer <JWT>"`.

## Endpoints

| Method | Path | What it does |
|---|---|---|
| GET  | `/health` | DB connectivity + property count |
| POST | `/api/auth/signup` · `/login` | Agency signup / login → JWT |
| GET  | `/api/auth/me` · `/users` | Current user / agency users |
| POST | `/api/auth/invite` | Admin adds an agent (admin only) |
| GET/POST | `/api/properties` | List (filtered) / create listings |
| GET/POST/PATCH/DELETE | `/api/leads` | Lead CRUD + pipeline `status` moves |
| GET/POST | `/api/leads/{id}/interactions` | Timeline: log & list touchpoints |
| GET  | `/api/pipeline` | Leads grouped by stage (kanban) |
| GET/POST/PATCH/DELETE | `/api/tasks` | Follow-ups / reminders |
| GET/POST/PATCH/DELETE | `/api/deals` | Deals; `GET /api/deals/summary` = revenue |
| POST | `/api/ai/search` | Conversational NL property finder (Claude + DB tool) |
| POST | `/api/ai/match` | Rank best properties for a lead, with rationale |
| POST | `/api/ai/pitch` | Draft a ready-to-send WhatsApp/email pitch |
| POST | `/api/ai/marketing` | Multi-channel marketing copy for a property |

### Quick try (after login — set `TOKEN`)

```bash
TOKEN=...   # from /api/auth/login

# Create a lead
curl -X POST localhost:8000/api/leads -H "content-type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Ahmed","whatsapp":"+9715...","budget_max":5000000,"bedrooms":2,"preferred_locations":"Dubai Marina, JBR","property_type":"Apartment"}'

# Log an interaction, move it down the pipeline
curl -X POST localhost:8000/api/leads/1/interactions -H "content-type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"channel":"call","direction":"out","body":"Called Ahmed, wants a sea view."}'
curl -X PATCH localhost:8000/api/leads/1 -H "content-type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"Qualified"}'

# AI pitch + marketing
curl -X POST localhost:8000/api/ai/pitch -H "content-type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"lead_id":1,"channel":"whatsapp"}'
curl -X POST localhost:8000/api/ai/marketing -H "content-type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"property_id":1,"channels":["listing","instagram","ad"]}'
```

## Migrations (Alembic)

Tables are auto-created on startup (`AUTO_CREATE_TABLES=true`) for zero-friction dev.
When you're ready to manage schema changes properly, switch to Alembic:

```bash
# 1. set AUTO_CREATE_TABLES=false in .env
# 2. generate the first migration from the models, then apply it
alembic revision --autogenerate -m "init schema"
alembic upgrade head
```

## Architecture notes

- **AI brain:** `app/ai/` — Anthropic Python SDK, `claude-opus-4-8`, adaptive thinking.
  `client.py` runs a manual tool-use loop; `broker_agent.py` holds search/match/pitch/marketing.
- **Multi-tenant:** every tenant row has `agency_id`; properties with `agency_id = NULL`
  are the shared market pool. Phase 1 adds auth/users + Postgres Row-Level Security.
- **Migrations:** currently `create_all` on startup. Phase 1 switches to Alembic.
- **Next:** Phase 1 = full CRM (pipeline, interactions, deals) + auth. Phase 3 = WhatsApp/email send.
