# Getting real Dubai property listings

There is **no official free API** that returns all Bayut/Property Finder listings.
Here are the real options, from "use it today" to "for the actual business".

## 1. RapidAPI — "Bayut" / "Realty in AE" (best free option to list real data NOW)
Unofficial APIs on [rapidapi.com](https://rapidapi.com) that mirror the Dubai portals.

- Search RapidAPI for **"Bayut"** (by ApiDojo) or **"Realty in AE"** (Property Finder data).
- Subscribe to the **free Basic plan** (a limited number of requests/month — check the
  current quota on the plan page).
- You get an **X-RapidAPI-Key** to use in request headers.

Typical endpoints (Bayut):
- `auto-complete` — turn an area name (e.g. "Dubai Marina") into a `locationExternalID`.
- `properties/list` — listings filtered by location, purpose (for-sale/for-rent),
  price, beds, etc. Returns title, price, area, beds/baths, coordinates, and **photos**.
- `properties/detail` — full detail + image gallery for one listing.

**Use for:** development, demo, your portfolio, an MVP. Real Dubai data, real photos.

> ⚠️ **Legal note:** these are *unofficial* (they scrape the portals). Fine for dev/demo,
> but for a **paid commercial product** scraping portal data can breach their terms. For
> the real business use options 3–4 below.

## 2. DLD / Dubai Pulse — official open data (free, legal)
The Dubai Land Department publishes real datasets on [dubaipulse.gov.ae](https://www.dubaipulse.gov.ae):
- **Transactions** (actual sale prices), **Rent Contracts**, **Projects**, **Units**, **Brokers**.

This is **transaction history, not live listings** — but it's gold for:
- Real **price trends** and **comparable sales** on the dashboard.
- Credibility ("based on official DLD data").

Free with registration; downloadable + some API access.

## 3. Reelly.io — off-plan / new projects
[reelly.io](https://reelly.io) provides Dubai **off-plan** (new development) data via an API,
aimed at agents. Good for listing new-launch projects. Partner/agent access.

## 4. The product path — agencies import their OWN listings
For a multi-tenant SaaS this is the clean, legal, scalable model:
- Agents already have their listings on Bayut/PF — let them **import** into your app.
- **Now:** CSV upload (map columns → our `properties` table).
- **Later:** ingest their portal **XML feed**, or list via the portals' official agency API.
- No scraping, no ToS risk, and it scales per tenant.

## Recommended setup for THIS project
- **Demo / browse real market data:** RapidAPI Bayut (free tier) → ingest into `properties`.
- **Per-agency real inventory:** CSV import (then feeds later).
- **Trends & comparables:** DLD / Dubai Pulse open data.

## How it plugs in
Whatever the source, the pattern is the same:
`fetch from source → map fields → upsert into the backend `properties` table`.
Then search / map / matching / marketing all work on real data automatically.
A scheduled job refreshes it (Phase 7 in `PLAN.md`).

---

## ✅ Built: Bayut import (how to use it)

1. **Get a free key:** rapidapi.com → search **"Bayut"** (by ApiDojo) → **Subscribe** to the
   free Basic plan → copy your **X-RapidAPI-Key**.
2. **Set it:** in `backend/.env` add `RAPIDAPI_KEY=your-key-here`.
3. **Reinstall + recreate the DB** (a new column `image_url` was added, so the old
   `dev.db` must be rebuilt):
   ```powershell
   pip install -r requirements.txt        # adds httpx
   Remove-Item dev.db                      # delete the old SQLite DB (recreated on boot)
   uvicorn app.main:app --reload --port 8000
   ```
   > On Supabase/Postgres instead of recreating, run a migration
   > (`alembic revision --autogenerate -m "property image fields" && alembic upgrade head`).
4. **Import:** open the frontend **Listings** page → set an area (e.g. "Dubai Marina") →
   **Import real listings**. Real Dubai properties with photos appear in your inventory.
   (Or call `POST /api/properties/import/bayut` from `/docs` as an admin.)

Free tiers are small — import a few areas, not the whole market. Dedupe is automatic
(by Bayut's listing id), so re-importing won't create duplicates.
