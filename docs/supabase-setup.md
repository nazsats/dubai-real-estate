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

## 4. Connecting from Render (production)

Local dev and Render need **different connection strings**, and this is the single
most common thing to get wrong:

| | Host | Username | Why |
|---|---|---|---|
| ❌ Direct | `db.<ref>.supabase.co:5432` | `postgres` | **Publishes only an AAAA (IPv6) record.** No IPv4 at all — fails with `getaddrinfo failed` on any network without IPv6, including most Windows dev machines and Render. |
| ✅ Session pooler | `aws-<n>-<region>.pooler.supabase.com:5432` | `postgres.<ref>` | IPv4. Right choice for a long-lived FastAPI process. |
| ⚠️ Transaction pooler | same host, port `6543` | `postgres.<ref>` | Works (statement cache is already disabled), but meant for serverless. |

**Two things change together — this is the trap.** Switching to the pooler means
changing *both* the host *and* the username. The pooler username embeds the
project ref (`postgres.oycfvwtagnytwdiosyiz`, not plain `postgres`). Swap only the
host and you get an auth failure that looks unrelated to the change you made.

**The `aws-<n>` prefix is not always `aws-0`.** Older Supabase docs show `aws-0-`,
but newer projects live on `aws-1-`. Connecting to the wrong one gives:

```
(ENOTFOUND) tenant/user postgres.<ref> not found
```

That message means "right pooler, wrong shard" — not a bad password. **Always copy
the exact string from Settings → Database → Connection string → Session pooler**
rather than assembling it by hand.

### Diagnosing a failed connection

| Error | Meaning |
|---|---|
| `socket.gaierror: [Errno 11001] getaddrinfo failed` | Using the direct IPv6-only host. Switch to the pooler. |
| `(ENOTFOUND) tenant/user … not found` | Reached a pooler, wrong region or `aws-<n>` prefix. |
| `InvalidPasswordError` | Host is right; password or username format is wrong. |
| Hangs, then times out | Project is paused — resume it in the dashboard. |

To check whether the project itself is alive, `curl https://<ref>.supabase.co/rest/v1/`.
A `401 {"message":"No API key found in request"}` means it's running fine.

### Connection limits

Every Render worker keeps its own SQLAlchemy pool, so the real ceiling is
`(DB_POOL_SIZE + DB_MAX_OVERFLOW) × workers`. The defaults (5 + 5) leave room on
Supabase's free tier for a single instance. Raise them only when you raise the
database plan — otherwise you'll hit "too many connections" long before you hit
any traffic worth celebrating.

### First boot

With `AUTO_CREATE_TABLES=true` the app creates its tables on first start. Watch
them appear under **Table Editor**. Keep `SEED_DEMO_DATA=false` in production so
the 2,000 fake listings never land in the real database.

## 5. (Later) Storage for property images
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
