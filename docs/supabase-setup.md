# Using Supabase as the database (+ storage)

Recommended adoption: **Supabase = managed Postgres + file storage; keep the FastAPI backend.**
No backend rewrite — you just point `DATABASE_URL` at Supabase. This also fixes the
"no local database" problem (the DB lives in the cloud).

## 1. Create the project
1. Go to **supabase.com** → sign in → **New project**.
2. Pick a name + region (closest to you / Dubai → e.g. `eu-central` or `me-central` if available).
3. Set a strong **database password** — save it.

## 2. Get the connection string
1. Project → **Settings → Database → Connection string**.
2. Choose the **Session pooler** tab (port `5432`, IPv4-friendly — works from a Windows dev machine).
3. Copy the URI. It looks like:
   ```
   postgresql://postgres.abcdefgh:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
   ```
4. Replace `[YOUR-PASSWORD]` with your DB password.

## 3. Point the backend at it
In `backend/.env`, set:
```env
DATABASE_URL=postgresql://postgres.abcdefgh:YOUR-PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
```
(The backend auto-converts `postgresql://` → `postgresql+asyncpg://` and disables the
prepared-statement cache so it works through Supabase's pooler.)

Restart the backend:
```powershell
uvicorn app.main:app --reload --port 8000
```
On first boot it creates all tables in Supabase and seeds demo data. You can watch the
rows appear under **Table Editor** in the Supabase dashboard.

> Tip: keep using `sqlite+aiosqlite:///./dev.db` for quick offline tests; switch to the
> Supabase URL when you want real cloud persistence + to see data in the dashboard.

## 4. (Later) Storage for property images
1. Supabase → **Storage → New bucket** → name `property-images` → make it **public**.
2. We'll add image upload/serving to the backend + a gallery in the frontend in the
   property-images feature step.

## Notes
- **Session pooler (5432)** is the simplest choice for our long-running FastAPI server.
  The transaction pooler (6543) also works now that the statement cache is disabled, but
  session mode is the safe default.
- Supabase's free tier is plenty for development and early customers.
- We are NOT using Supabase Auth yet — the app keeps its own JWT auth. We can switch to
  Supabase Auth later if you want social logins / magic links.
