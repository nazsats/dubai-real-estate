"""Bulk-import REAL Dubai listings from the RapidAPI Bayut API across all major areas.

Pulls live listings (with photos, real prices) into the shared property pool, deduped
against what's already imported. Needs RAPIDAPI_KEY in backend/.env.

Run from backend/ with the venv active:
    python import_listings.py                 # 2 pages/area (~700 listings)
    python import_listings.py 4               # 4 pages/area (more listings)
    python import_listings.py 3 --fresh       # first delete the ~2,000 seeded demo
                                              # properties, then import only real ones

NOTE on quota: each page = ~25 listings = 1 RapidAPI request, plus 1 lookup per area.
The free tier has a monthly cap — start small and increase if you have quota.
"""
import asyncio
import sys

import httpx
from sqlalchemy import delete, func, select

from app.config import get_settings
from app.db import SessionLocal
from app.integrations import bayut
from app.models import Property

AREAS = [
    "Dubai Marina", "Downtown Dubai", "Palm Jumeirah", "Business Bay", "Jumeirah Village Circle",
    "Dubai Hills Estate", "Jumeirah Beach Residence", "Dubai Creek Harbour", "Arabian Ranches",
    "Al Furjan", "Meydan", "Jumeirah Lake Towers", "Dubai South", "Emirates Hills",
]


async def main(pages_per_area: int, fresh: bool) -> None:
    settings = get_settings()
    if not settings.rapidapi_key:
        print("RAPIDAPI_KEY not set in backend/.env — add your RapidAPI (Bayut) key first.")
        return

    async with SessionLocal() as session:
        if fresh:
            res = await session.execute(delete(Property).where(Property.source == "seed"))
            await session.commit()
            print(f"Removed {res.rowcount} seeded demo properties.\n")

        total_added = 0
        async with httpx.AsyncClient() as client:
            for area in AREAS:
                try:
                    loc_id = await bayut.resolve_location_id(client, area)
                    mapped: list[dict] = []
                    for page in range(max(1, pages_per_area)):
                        hits = await bayut.fetch_listings(client, loc_id, "for-sale", page)
                        if not hits:
                            break
                        for hit in hits:
                            row = bayut.map_hit_to_property(hit, None)  # None => shared pool
                            if row:
                                mapped.append(row)
                        await asyncio.sleep(0.3)  # be polite to the API
                except httpx.HTTPStatusError as exc:
                    if exc.response.status_code == 429:
                        print("\nRate limit reached (429) — stopping. Try again later or upgrade quota.")
                        break
                    print(f"  {area}: API error {exc.response.status_code}, skipping")
                    continue
                except httpx.HTTPError as exc:
                    print(f"  {area}: request failed ({exc}), skipping")
                    continue

                # Dedupe against already-imported listings.
                ext = [r["external_id"] for r in mapped if r["external_id"]]
                existing: set[str] = set()
                if ext:
                    rows = await session.execute(select(Property.external_id).where(Property.external_id.in_(ext)))
                    existing = {e for (e,) in rows.all()}

                added = 0
                for r in mapped:
                    if r["external_id"] and r["external_id"] in existing:
                        continue
                    session.add(Property(**r))
                    existing.add(r["external_id"])
                    added += 1
                await session.commit()
                total_added += added
                print(f"  {area}: +{added} real listings")

        grand = (
            await session.execute(select(func.count(Property.id)).where(Property.source == "bayut"))
        ).scalar_one()
        print(f"\nDone. Added {total_added} listings this run · {grand} real Bayut listings total.")


if __name__ == "__main__":
    pages = 2
    fresh = "--fresh" in sys.argv
    for a in sys.argv[1:]:
        if a.isdigit():
            pages = int(a)
    asyncio.run(main(pages, fresh))
