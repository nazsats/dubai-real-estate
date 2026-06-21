"""One-off: pull real Dubai listings from the RapidAPI Bayut API into the shared pool.

Run from backend/:  python import_bayut.py
Reuses app.integrations.bayut so mapping stays in sync with the live import endpoint.
Listings go into the shared pool (agency_id=NULL) so every tenant sees them, and are
deduped against existing external_ids.
"""
import asyncio

import httpx
from sqlalchemy import select

from app.config import get_settings
from app.db import SessionLocal
from app.integrations import bayut
from app.models import Property

settings = get_settings()

# Dubai city-wide, several pages (~25 hits/page) — gives a good spread of communities.
LOCATION = "Dubai"
PAGES = 8
PURPOSE = "for-sale"


async def main() -> None:
    if not settings.rapidapi_key:
        raise SystemExit("RAPIDAPI_KEY not set in backend/.env")

    mapped: list[dict] = []
    async with httpx.AsyncClient() as client:
        loc_id = await bayut.resolve_location_id(client, LOCATION)
        for page in range(PAGES):
            try:
                hits = await bayut.fetch_listings(client, loc_id, PURPOSE, page)
            except httpx.HTTPStatusError as exc:
                print(f"  page {page}: HTTP {exc.response.status_code} — {exc.response.text[:120]}")
                break
            except httpx.HTTPError as exc:
                print(f"  page {page}: request failed: {exc}")
                break
            if not hits:
                break
            for hit in hits:
                row = bayut.map_hit_to_property(hit, agency_id=None)  # shared pool
                if row:
                    mapped.append(row)
            print(f"  page {page}: fetched {len(hits)}")

    if not mapped:
        raise SystemExit("No listings fetched — check the RapidAPI key/subscription.")

    async with SessionLocal() as session:
        ext_ids = [r["external_id"] for r in mapped if r["external_id"]]
        existing: set[str] = set()
        if ext_ids:
            rows = await session.execute(
                select(Property.external_id).where(Property.external_id.in_(ext_ids))
            )
            existing = {e for (e,) in rows.all()}

        imported = skipped = 0
        for row in mapped:
            if row["external_id"] and row["external_id"] in existing:
                skipped += 1
                continue
            session.add(Property(**row))
            existing.add(row["external_id"])
            imported += 1
        await session.commit()

    print(f"\nDone: imported {imported}, skipped {skipped} (already had), fetched {len(mapped)}")


if __name__ == "__main__":
    asyncio.run(main())
