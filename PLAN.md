# Dubai AI Broker Assistant — Product & Build Plan

> Vision: an AI assistant that does everything a Dubai real-estate broker does —
> inventory, leads, pitching, marketing, follow-up, viewings, sales, revenue,
> WhatsApp & email — sold as a **multi-tenant SaaS** to real-estate agencies.

## Decisions locked
- **First build:** CRM + pipeline core (the backbone).
- **Audience:** Multi-tenant SaaS for many agencies (proper accounts, billing, isolation).
- **Integrations in scope:** WhatsApp Business API, Email (Gmail/SMTP), Real listing source (Bayut/Property Finder/DLD), Claude (Anthropic) API.
- **AI brain:** Claude (`claude-opus-4-8`, adaptive thinking) with tool-calling, replacing gpt-4o-mini.
- **Backend = Python FastAPI (async), frontend = Next.js + TypeScript + Tailwind.** Marketing features prioritized.

## Status
- ✅ **Phase 0 — done:** repo cleaned (`venv-clean` untracked, `.gitignore` fixed, legacy app moved to `legacy/`), FastAPI backend scaffolded under `backend/`, async SQLAlchemy + multi-tenant models, demo seed.
- ✅ **Phase 2 — done (initial):** Claude broker brain in `backend/app/ai/` — `/api/ai/search` (NL finder w/ DB tool), `/api/ai/match`, `/api/ai/pitch` (WhatsApp/email), `/api/ai/marketing` (multi-channel copy). Cost-controlled (Haiku default, no thinking, token caps, per-minute rate limit).
- ✅ **Phase 1 — done:** JWT auth (agency signup/login/invite, roles), tenant scoping on every route, CRM models (`users`, `interactions`, `tasks`, `deals` + lead pipeline stages), routers for leads (CRUD + pipeline moves + timeline), pipeline board, tasks, deals + `/api/deals/summary` revenue, Alembic scaffolding. Demo login `demo@demo.ae` / `demo12345`.
- ✅ **Frontend v1 — done:** Next.js 14 + TS + Tailwind (`frontend/`). Animated login, dashboard (live stat cards, **animated UAE market map** via Leaflet, Recharts trends/price/stage/type), pipeline kanban (add + move leads), AI search. Backend analytics endpoint `/api/analytics/dashboard`.
- ✅ **Telegram bot — done:** `telegram_bot/` — operate the agent in Telegram (NL search + `/newlead`), backed by the API. (WhatsApp deferred per user.)
- ✅ **Real listing data — done (Phase 7 start):** RapidAPI **Bayut import** + **CSV import** (per-agency, legal path) → `properties` (image_url/external_id/source). Listings gallery page with photos + import controls.
- ✅ **Market Trends — done:** `/api/analytics/market` + `/market` page with many chart types (price bands, bedroom mix, type donut, ready/off-plan radial, price-range-by-type composed, ppsf-by-area, size-vs-price scatter, area radar, area treemap). Powered by real imported inventory; DLD/Dubai Pulse can layer in once registered.
- ⏭️ **Next:** lead detail page (timeline + AI match/pitch/marketing panels); DLD/Dubai Pulse transactions ingestion; Phase 3 outreach (Telegram push → WhatsApp).

---

## Target architecture

```
                      ┌─────────────────────────────┐
                      │  Frontend (Streamlit v1 →    │
                      │  Next.js/React for product)  │
                      └──────────────┬──────────────┘
                                     │ HTTPS
                      ┌──────────────▼──────────────┐
                      │   FastAPI backend (async)    │
                      │  - Auth + tenant middleware  │
                      │  - REST API + webhooks       │
                      │  - Claude agent (tool-calls) │
                      └───┬─────────┬─────────┬──────┘
                          │         │         │
        ┌─────────────────▼──┐  ┌───▼─────┐ ┌─▼─────────────┐
        │ PostgreSQL (multi- │  │ Workers │ │ Integrations  │
        │ tenant, RLS)       │  │ (jobs)  │ │ WA / Email /  │
        │                    │  │         │ │ Calendar /    │
        └────────────────────┘  └─────────┘ │ Listings feed │
                                            └───────────────┘
```

- **Backend:** FastAPI (async, typed, OpenAPI docs) — replaces Flask.
- **DB:** PostgreSQL with a `tenant_id` (agency) on every row + Row-Level Security for isolation.
- **AI:** Claude with tools: `search_listings`, `match_for_lead`, `draft_message`, `score_lead`, `create_brochure`, `log_interaction`.
- **Background jobs:** follow-up reminders, listing refresh, daily reports (APScheduler/Celery).
- **Channels:** WhatsApp Cloud API (Meta) or Twilio; Gmail API / SMTP; Google Calendar.

---

## Multi-tenant data model (core tables)

- `agencies` — the tenant (name, plan, branding, billing status).
- `users` — agents/admins, belong to an agency, role-based.
- `leads` — prospective buyers/renters (source, status, score, language, budget, needs).
- `clients` — converted leads (KYC, preferences).
- `properties` — real listings (replaces synthetic seed), per-agency + shared pool.
- `interactions` — every touch: WhatsApp, email, call, note (timeline per lead).
- `viewings` — scheduled property visits (linked to calendar).
- `deals` — pipeline stage, value, commission, payment status.
- `messages` — inbound/outbound channel messages (WA/email), threaded.
- `campaigns` — marketing posts/ads generated per property.
- `tasks` — follow-ups & reminders (auto + manual).

Pipeline stages: `New → Contacted → Qualified → Viewing → Negotiation → Closed-Won / Closed-Lost`.

---

## Phased rollout

### Phase 0 — Cleanup & foundation (½–1 day)
- Remove `venv-clean/` from git history; fix corrupted `.gitignore`; add `.env.example`.
- Restructure into a package: `/backend`, `/frontend`, `/db/migrations`, `/workers`, `/integrations`.
- Stand up FastAPI skeleton + Postgres migrations (Alembic).

### Phase 1 — CRM + pipeline core ★ START HERE
- Auth (agency signup, agent invite, login, roles) + tenant middleware + RLS.
- Tables: agencies, users, leads, clients, interactions, deals, tasks.
- Kanban pipeline UI; lead detail page with interaction timeline.
- Manual lead entry + CSV import.

### Phase 2 — AI matching & pitching
- Migrate AI brain to Claude with tool-calling.
- `match_for_lead`: rank listings for a lead's stated needs + budget.
- Auto-generate personalized, branded **PDF brochure / shortlist** per client.
- Lead scoring (hot/warm/cold) from interactions + fit.

### Phase 3 — Outreach (WhatsApp + Email)
- WhatsApp Cloud API: send/receive, templates, inbound webhook → `messages` + timeline.
- Email (Gmail API/SMTP): send pitches, brochures, follow-ups.
- AI-drafted, multilingual (EN/AR/RU/etc.) messages, agent approves or auto-sends.

### Phase 4 — Follow-up automation & viewings
- Background reminders; "lead gone cold" nudges.
- Viewing booking → Google Calendar sync; reminders to client + agent.

### Phase 5 — Marketing automation
- From any property: auto-write portal listing copy, Instagram/social posts, ad copy.
- Campaign tracker per property.

### Phase 6 — Dashboard, sales & revenue
- Commission tracking, payment status, deal log.
- Funnel/conversion %, revenue charts, per-agent leaderboard, top areas.

### Phase 7 — Real Dubai inventory
- Replace synthetic seed with real listings: Bayut/Property Finder API, DLD data, or scrapers.
- Scheduled refresh, dedup, price-history tracking.

### Phase 8 — SaaS hardening (productization)
- Billing (Stripe) + plan limits; onboarding; per-agency branding.
- Migrate frontend to Next.js/React for daily-use polish.
- Audit logs, rate limits, monitoring.

---

## Immediate next steps (Phase 0 + start of 1)
1. Clean repo (`venv-clean`, `.gitignore`, `.env.example`).
2. New project structure + FastAPI skeleton.
3. Alembic + first migration: `agencies`, `users`, `leads`, `interactions`, `deals`.
4. Auth + tenant isolation.
5. Minimal pipeline UI to prove the loop end-to-end.

## Notes / risks
- WhatsApp Business API requires Meta business verification — start that approval early (slow).
- Real listing data: confirm legal/ToS for the chosen source (portal APIs vs scraping).
- Keep the existing Streamlit search as a feature inside the CRM, not the whole product.
