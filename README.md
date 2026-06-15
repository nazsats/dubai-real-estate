# Dubai AI Broker Assistant

An AI assistant that automates what a Dubai real-estate broker does — inventory, leads,
matching, pitching, marketing, follow-up, sales and revenue — built as a **multi-tenant SaaS**
for real-estate agencies. Powered by **Claude (`claude-opus-4-8`)**.

> 📋 Full product & build roadmap: **[PLAN.md](PLAN.md)**

## Current state

- ✅ **Backend** (`backend/`) — FastAPI + async SQLAlchemy (Postgres) + Anthropic Claude.
  Multi-tenant CRM (auth, leads, pipeline, interactions, tasks, deals/revenue) + the broker
  brain (NL search, match, pitch, marketing) + live analytics. See [backend/README.md](backend/README.md).
- ✅ **Frontend** (`frontend/`) — Next.js 14 + TypeScript + Tailwind. Animated dashboard with a
  **UAE market map** + charts, pipeline kanban, AI search. See [frontend/README.md](frontend/README.md).
- ✅ **Telegram bot** (`telegram_bot/`) — operate the agent from Telegram today. See [telegram_bot/README.md](telegram_bot/README.md).
- 🗄️ **`legacy/`** — the original Streamlit + LangChain prototype, kept for reference.

## Run the whole stack (3 terminals)

1. **Backend** — `cd backend` → venv + `pip install -r requirements.txt` → set `.env` → `uvicorn app.main:app --reload --port 8000`
2. **Frontend** — `cd frontend` → `npm install` → `npm run dev` → http://localhost:3000 (login `demo@demo.ae` / `demo12345`)
3. **Telegram** (optional) — `cd telegram_bot` → venv + `pip install -r requirements.txt` → set `.env` token → `python bot.py`

See [docs/free-apis.md](docs/free-apis.md) for free APIs to enrich the product.

## Quickstart (backend)

Windows **PowerShell** (run each line separately — PowerShell doesn't support `&&`):

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env    # then edit .env: set DATABASE_URL + ANTHROPIC_API_KEY
uvicorn app.main:app --reload --port 8000
```

macOS / Linux:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Then open **http://localhost:8000/docs**. First boot creates tables and seeds demo properties.

> 💸 **Costs are kept low by default:** the cheapest model (Haiku), extended thinking off,
> a 1,500-token output cap, and a 15-AI-calls/minute guard. Tune these in `.env`
> (`CLAUDE_MODEL`, `USE_THINKING`, `AI_MAX_TOKENS`, `AI_RATE_LIMIT_PER_MINUTE`).

## Tech stack

- **Backend:** FastAPI, async SQLAlchemy 2.0, asyncpg, PostgreSQL
- **AI:** Anthropic Python SDK, `claude-opus-4-8` (adaptive thinking), tool-calling
- **Frontend (planned):** Next.js, TypeScript, Tailwind CSS
- **Integrations (planned):** WhatsApp Business API, Gmail/SMTP, listing feeds (Bayut/Property Finder/DLD)
