# Dubai AI Broker Assistant — Project Overview

> A complete, single-source reference: mission, features, tech, architecture, what's built,
> how to run it, the roadmap, and ideas to take it further.

---

## 1. Mission & Vision

**Mission:** Give every Dubai real-estate agent an AI partner that automates the entire
brokerage workflow — so they spend time closing deals, not on busywork.

**Vision:** The operating system for Dubai real-estate agencies — where inventory, leads,
client communication, marketing, and revenue all live in one intelligent place, sold as a
**multi-tenant SaaS** to agencies across the UAE (and beyond).

**One-line pitch:** *Your AI real-estate broker, working 24/7.*

---

## 2. The Problem & the Innovation

**The problem:** A Dubai broker juggles 6–8 disconnected tools — portals (Bayut/Property
Finder), spreadsheets for leads, WhatsApp for clients, Canva for marketing, separate CRMs —
and does repetitive work by hand: matching buyers to listings, writing pitches, creating
marketing, chasing follow-ups, tracking commissions.

**The innovation:** One assistant powered by **Claude** that actually *does the work* —
reads a buyer's needs, ranks the best listings with reasoning, writes ready-to-send pitches
in the client's language, generates multi-channel marketing, and tracks every lead and dirham —
all grounded in **real Dubai market data** and operable from a web dashboard **or Telegram**.

What makes it different:
- **Action, not just chat** — the AI uses tools (DB search) and produces ship-ready output
  (pitches, marketing, shortlists), not generic answers.
- **Dubai-native** — areas, AED pricing, DLD market context, local norms baked in.
- **Multi-channel** — web app today, Telegram now, WhatsApp next.
- **Real data** — live listings (Bayut/CSV) and a market-trends engine, not mock data.
- **Cost-engineered** — cheap model by default, token caps, rate limits — runs lean.

---

## 3. Features (what it does today)

### Inventory & listings
- Tenant-scoped property inventory + a shared market pool.
- **Import real Dubai listings** from the RapidAPI Bayut API (with photos), auto-deduped.
- **CSV import** for an agency's own listings (the clean, legal path) + downloadable template.
- Listings gallery with photos, price, beds, size, ready/off-plan.

### AI broker brain (Claude)
- **Natural-language search** — "3 bed in Dubai Marina under 5M with a pool" → ranked results with photos.
- **Lead → property matching** — ranks the best listings for a specific lead, with a reason per pick.
- **Pitching** — generates ready-to-send **WhatsApp** or **email** pitches in the client's language.
- **Marketing** — multi-channel copy per property: portal listing, Instagram caption, ad variants, story, email blast.

### CRM & pipeline
- Auth: agency signup, agent invite, roles (admin/agent), JWT.
- Leads with full requirements; **kanban pipeline** (New → Contacted → Qualified → Viewing → Negotiation → Won → Lost).
- **Lead detail page** — info, **activity timeline**, and one-click AI Match / Pitch / Marketing (end-to-end).
- Tasks/reminders; deals with **commission & revenue tracking**.

### Analytics
- **Dashboard** — live stat cards, an animated **UAE market map** (inventory + avg price by area), lead trends, conversion, revenue.
- **Market Trends** — 9+ chart types (price distribution, bedroom mix, type donut, ready/off-plan radial, price-range-by-type, price/sqft by area, size-vs-price scatter, area radar, inventory treemap).

### Channels
- **Web app** (Next.js) — the full product.
- **Telegram bot** — operate the assistant from chat (NL search + lead capture). WhatsApp deferred until tested.

---

## 4. Tech Stack

| Layer | Technology |
|---|---|
| **AI** | Anthropic **Claude** (`claude-opus-4-8` / `claude-haiku-4-5`), official Python SDK, tool-calling |
| **Backend** | Python 3.11+, **FastAPI** (async), **SQLAlchemy 2.0** (async), Pydantic v2 |
| **Database** | **PostgreSQL** (via **Supabase** in the cloud) / SQLite for local dev; **Alembic** migrations |
| **Auth** | JWT (PyJWT) + bcrypt password hashing |
| **Frontend** | **Next.js 14** (App Router), **TypeScript**, **Tailwind CSS**, **shadcn/ui-style** components (Radix + CVA) |
| **UI/UX** | **Framer Motion** (animation), **Recharts** (charts), **Leaflet / react-leaflet** (maps), lucide-react, sonner |
| **Integrations** | RapidAPI **Bayut** (listings), CSV import, **Telegram** (python-telegram-bot), **Supabase** Storage |
| **Data (planned)** | **DLD / Dubai Pulse** open data (transactions/trends) |
| **HTTP/infra** | httpx, uvicorn, CORS |

> Note: this is a current, in-demand 2026 stack. The "modern" feel comes from the design
> system (shadcn/ui) + animation + real data, not from chasing newer frameworks.

---

## 5. Architecture

```
            ┌──────────────────────────────┐        ┌─────────────────────┐
            │  Next.js frontend (web app)  │        │   Telegram bot      │
            │  landing, dashboard, CRM,    │        │  (python-telegram)  │
            │  listings, market, AI search │        └──────────┬──────────┘
            └──────────────┬───────────────┘                   │
                           │ REST + JWT                        │ REST + JWT
                           ▼                                   ▼
            ┌──────────────────────────────────────────────────────────────┐
            │                 FastAPI backend (async)                       │
            │  auth · leads · pipeline · tasks · deals · analytics · ai     │
            │  ┌───────────────┐   ┌──────────────────────────────────────┐ │
            │  │ Claude brain  │   │ Integrations: Bayut, CSV, (DLD next) │ │
            │  │ (tool-calling)│   └──────────────────────────────────────┘ │
            │  └───────────────┘                                            │
            └───────────────────────────┬──────────────────────────────────┘
                                        │ async SQLAlchemy
                                        ▼
                        ┌──────────────────────────────┐
                        │  PostgreSQL (Supabase)        │
                        │  multi-tenant (agency_id)     │
                        └──────────────────────────────┘
```

**Multi-tenancy:** every tenant-owned row carries `agency_id`; shared listings use `agency_id = NULL`.
Every API route is scoped to the authenticated user's agency. (Postgres Row-Level Security is the next hardening step.)

---

## 6. Repository structure

```
dubai-real-estate/
├─ backend/                     FastAPI + Claude + DB
│  ├─ app/
│  │  ├─ main.py                app factory, routers, startup (create tables + seed)
│  │  ├─ config.py              settings (.env): DB, Claude, cost controls, RapidAPI
│  │  ├─ db.py                  async engine/session (Supabase-pooler safe)
│  │  ├─ models.py              Agency, User, Property, Lead, Interaction, Task, Deal
│  │  ├─ schemas.py             Pydantic request/response models
│  │  ├─ security.py            bcrypt + JWT
│  │  ├─ ratelimit.py           AI spend guard (per-minute)
│  │  ├─ seed.py                demo agency/admin + ~2,000 demo properties
│  │  ├─ ai/
│  │  │  ├─ client.py           Anthropic client + manual tool-use loop + cost knobs
│  │  │  └─ broker_agent.py     search, match, pitch, marketing
│  │  ├─ integrations/
│  │  │  └─ bayut.py            RapidAPI Bayut → Property mapping
│  │  └─ api/                   auth, properties, leads, pipeline, tasks, deals, analytics, ai, health
│  ├─ alembic/                  migrations scaffold
│  ├─ requirements.txt · .env.example
├─ frontend/                    Next.js 14 + TS + Tailwind + shadcn-style
│  ├─ app/
│  │  ├─ page.tsx               animated landing page
│  │  ├─ login/                 auth
│  │  └─ (app)/                 protected: dashboard, listings, market, pipeline, leads/[id], search
│  ├─ components/               Sidebar, PropertyCard, ui/*, dashboard/*, market/*
│  └─ lib/                      api client, auth context, formatters
├─ telegram_bot/                Telegram front-end (NL search + /newlead)
├─ docs/                        supabase, whatsapp, telegram, property-data, free-apis
├─ legacy/                      original Streamlit prototype (reference)
├─ PLAN.md                      phased build roadmap + status
└─ PROJECT_OVERVIEW.md          this file
```

---

## 7. Data model (core tables)

- **agencies** — the tenant (name, slug).
- **users** — agents/admins (email, hashed_password, role, agency_id).
- **properties** — listings (location, building, price, type, bedrooms, size, amenities,
  possession, **image_url**, **external_id**, **source**: manual/seed/bayut/csv; `agency_id` NULL = shared pool).
- **leads** — buyers (contact, language, **status** pipeline stage, **score**, budget, beds,
  type, preferred areas, notes, owner_id).
- **interactions** — the timeline (channel, direction, body) per lead.
- **tasks** — follow-ups/reminders (title, due_at, done).
- **deals** — sales (value, **commission**, stage, payment_status, close dates).

---

## 8. API surface

```
Auth      POST /api/auth/signup · /login   GET /api/auth/me · /users   POST /api/auth/invite
Props     GET/POST /api/properties   GET /api/properties/{id}
          POST /api/properties/import/bayut   POST /api/properties/import/csv   GET …/csv/template
Leads     GET/POST /api/leads   GET/PATCH/DELETE /api/leads/{id}
          GET/POST /api/leads/{id}/interactions
Pipeline  GET /api/pipeline
Tasks     GET/POST /api/tasks   PATCH/DELETE /api/tasks/{id}   POST /api/tasks/{id}/done
Deals     GET/POST /api/deals   GET /api/deals/summary   PATCH/DELETE /api/deals/{id}
Analytics GET /api/analytics/dashboard   GET /api/analytics/market
AI        POST /api/ai/search · /match · /pitch · /marketing
Health    GET /health
```
Interactive docs at `http://localhost:8000/docs`.

---

## 9. AI design & cost control

- **Model tiering:** Haiku by default (cheap/fast); Sonnet/Opus available when quality matters (`CLAUDE_SMART_MODEL`).
- **Tool-calling:** a manual agentic loop so DB search tools stay tenant-scoped.
- **Cost guards:** extended thinking off by default, output token caps (`AI_MAX_TOKENS`),
  per-minute rate limit (`AI_RATE_LIMIT_PER_MINUTE`), trimmed prompt/context sizes.
- **Latency reality:** the Claude call dominates response time (I/O-bound), so smart model
  choice + streaming matter more than backend micro-optimizations.

---

## 10. Build status

| Phase | Status |
|---|---|
| 0 — Cleanup & FastAPI foundation | ✅ Done |
| 1 — CRM core (auth, pipeline, interactions, tasks, deals) | ✅ Done |
| 2 — AI brain (search, match, pitch, marketing) | ✅ Done |
| Frontend v1 + design overhaul (shadcn, landing) | ✅ Done |
| Telegram bot | ✅ Done |
| Real data (Bayut + CSV import) | ✅ Done |
| Market Trends analytics | ✅ Done |
| Lead detail page + AI panels (end-to-end) | ✅ Done |
| 3 — Outreach send (Telegram push → WhatsApp) | ⏳ Next |
| DLD / Dubai Pulse transaction data | ⏳ Planned |
| 8 — SaaS hardening (billing, RLS, Next.js polish) | ⏳ Planned |

---

## 11. Run it (full stack)

**Backend** (PowerShell, one line at a time):
```powershell
cd backend; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# .env: DATABASE_URL (sqlite or Supabase) + ANTHROPIC_API_KEY (+ RAPIDAPI_KEY)
uvicorn app.main:app --reload --port 8000
```
**Frontend:**
```powershell
cd frontend; npm install; npm run dev   # http://localhost:3000
```
**Telegram (optional):** `cd telegram_bot` → install → set token → `python bot.py`.

Demo login: **demo@demo.ae / demo12345**.

---

## 12. Roadmap & future enhancements

**Near term**
- Outreach send: push pitches via Telegram, then WhatsApp Business API (verification in progress).
- Email integration (Gmail/SMTP) for pitches + drip follow-ups.
- DLD/Dubai Pulse ingestion → real transaction trends + comparable sales.
- Lead **auto-scoring** (AI heat score from interactions + fit).
- Realtime pipeline (Supabase realtime) + notifications.

**Product depth**
- Property images via Supabase Storage; photo galleries + virtual-tour links.
- Document/contract generation (offer letters, MOUs) with e-sign.
- Viewing scheduler synced to Google Calendar.
- Multi-currency budgets for international buyers (exchangerate.host).
- "What's nearby" enrichment (metro/schools/malls via Overpass).
- Command palette (⌘K), dark/light, saved searches, CSV/PDF exports.

**AI**
- Streaming responses (SSE) for instant-feel search/pitch.
- Prompt caching to cut cost; per-tenant usage metering.
- Voice notes → lead capture; auto-summarize call transcripts.
- A "daily briefing" agent (hot leads, due follow-ups, new matches).

**SaaS hardening**
- Stripe billing + plan limits; onboarding wizard; per-agency branding.
- Postgres Row-Level Security; audit logs; rate limits per tenant.
- Multi-agency Telegram/WhatsApp onboarding (Embedded Signup).
- Migrate to a polished Next.js production UI; e2e tests; CI/CD.

---

## 13. Ideas to make it better (growth & moat)

- **Data moat:** accumulate anonymized deal/price data → unique Dubai market insights agencies can't get elsewhere.
- **Lead marketplace:** capture web leads (landing pages per agency) and route them in.
- **Agent performance & coaching:** leaderboards, conversion analytics, AI suggestions ("follow up with these 5 cold leads").
- **Buyer-facing mini-site:** auto-generated, shareable property shortlists per client.
- **Off-plan focus:** integrate developer feeds (Reelly) — off-plan is huge in Dubai.
- **Arabic-first UX** + RTL; full multilingual pitches (EN/AR/RU/FA/HI/ZH).
- **Mobile app** (React Native) — agents live on their phones.

---

## 14. Business model (monetization)

- **SaaS subscription** per agency, tiered by seats + AI usage (Starter / Pro / Agency).
- **Usage add-ons:** AI marketing/pitch credits, premium data (DLD comparables).
- **Per-seat** pricing for agents; **white-label** for larger brokerages.
- Free trial → demo agency; convert on the "it writes my pitches & marketing" wow.

---

## 15. Goals

**Short term (0–3 months):** finish outreach (Telegram→WhatsApp) + email, ingest DLD trends,
ship a polished, billable v1; onboard the first 1–3 real agencies.

**Long term:** become the default workspace for Dubai agents; expand to the wider GCC;
build the proprietary market-data layer that makes the product indispensable.

---

*Built with FastAPI, Next.js, and Claude — for the Dubai real-estate market.*
