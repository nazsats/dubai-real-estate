"""Load DLD transaction history from a Dubai Pulse CSV export.

    python import_dld.py path/to/Transactions.csv
    python import_dld.py path/to/Transactions.csv --limit 50000

WHY A CSV AND NOT AN API CALL
-----------------------------
Dubai Pulse serves the DLD `Transactions` dataset behind a UAE-only network
boundary — from outside the region, port 443 on dubaipulse.gov.ae simply times
out (the hostname resolves; the TCP connection never completes). Access also
requires a registered account. So there is no unattended fetch to write: you
download the export while signed in, and this script loads it.

Get the file:
  1. dubaipulse.gov.ae -> sign in (free registration)
  2. Data -> Dubai Land Department -> "Transactions"
  3. Download CSV (the full export is large; a filtered/recent slice is fine)

The column mapping below follows Dubai Pulse's published English headers and
falls back across the variants seen in different exports, so a header rename
degrades to "column missing" rather than silently importing nulls.
"""
import asyncio
import csv
import sys
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db import SessionLocal, engine
from app.models import Base, DldTransaction

SQM_TO_SQFT = 10.7639

# Each field lists the header spellings seen across Dubai Pulse exports, in
# preference order.
COLUMNS = {
    "external_id": ["transaction_id", "trans_id", "transaction_number"],
    "date": ["instance_date", "transaction_date", "date"],
    "area": ["area_name_en", "area_en", "area"],
    "building": ["building_name_en", "building_name", "master_project_en"],
    "project": ["project_name_en", "project_en", "project_name"],
    "ptype": ["property_type_en", "property_type"],
    "psubtype": ["property_sub_type_en", "property_sub_type"],
    "rooms": ["rooms_en", "rooms", "no_of_rooms"],
    "size_sqm": ["procedure_area", "actual_area", "property_size_sqm"],
    "price": ["actual_worth", "trans_value", "amount"],
    "ppsm": ["meter_sale_price", "price_per_meter"],
    "procedure": ["procedure_name_en", "procedure_name", "trans_group_en"],
    "regtype": ["reg_type_en", "registration_type"],
}

# Dubai Pulse writes bedroom counts as words.
ROOMS = {
    "studio": 0, "1 b/r": 1, "2 b/r": 2, "3 b/r": 3, "4 b/r": 4,
    "5 b/r": 5, "6 b/r": 6, "7 b/r": 7, "8 b/r": 8,
    "single room": 1, "penthouse": None, "shop": None, "office": None,
}


def pick(row: dict, key: str) -> str | None:
    for name in COLUMNS[key]:
        if name in row and str(row[name]).strip():
            return str(row[name]).strip()
    return None


def to_float(v: str | None) -> float | None:
    if not v:
        return None
    try:
        return float(v.replace(",", "").strip())
    except ValueError:
        return None


def to_rooms(v: str | None) -> int | None:
    if not v:
        return None
    key = v.strip().lower()
    if key in ROOMS:
        return ROOMS[key]
    head = key.split()[0]
    return int(head) if head.isdigit() else None


def to_date(v: str | None) -> datetime | None:
    if not v:
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S", "%m/%d/%Y"):
        try:
            return datetime.strptime(v.split(".")[0], fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def normalize_type(ptype: str | None, psub: str | None) -> str:
    """Collapse DLD's type vocabulary onto the four types used elsewhere."""
    blob = f"{ptype or ''} {psub or ''}".lower()
    if "villa" in blob:
        return "Villa"
    if "town" in blob:
        return "Townhouse"
    if "penthouse" in blob:
        return "Penthouse"
    if "flat" in blob or "apartment" in blob or "unit" in blob:
        return "Apartment"
    return (ptype or "Other").title()


def map_row(row: dict) -> dict | None:
    date = to_date(pick(row, "date"))
    price = to_float(pick(row, "price"))
    area = pick(row, "area")
    if not (date and price and area) or price <= 0:
        return None  # a transaction without a date, price, or area is unusable

    size_sqm = to_float(pick(row, "size_sqm"))
    size_sqft = round(size_sqm * SQM_TO_SQFT) if size_sqm else None

    ppsf = None
    ppsm = to_float(pick(row, "ppsm"))
    if ppsm:
        ppsf = round(ppsm / SQM_TO_SQFT, 2)   # DLD reports per square METRE
    elif size_sqft:
        ppsf = round(price / size_sqft, 2)

    procedure = (pick(row, "procedure") or "Sales").lower()
    ttype = "Mortgages" if "mortgage" in procedure else "Gifts" if "gift" in procedure else "Sales"

    return {
        "external_id": pick(row, "external_id"),
        "transaction_date": date,
        "area": area[:120],
        "building": (pick(row, "building") or None),
        "project": (pick(row, "project") or None),
        "property_type": normalize_type(pick(row, "ptype"), pick(row, "psubtype")),
        "rooms": to_rooms(pick(row, "rooms")),
        "size_sqft": size_sqft,
        "price_aed": price,
        "price_per_sqft": ppsf,
        "transaction_type": ttype,
        "registration_type": pick(row, "regtype"),
    }


async def main(path: str, limit: int | None) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    seen, kept, skipped = 0, 0, 0
    batch: list[dict] = []

    async with SessionLocal() as session:
        with open(path, encoding="utf-8-sig", newline="") as fh:
            reader = csv.DictReader(fh)
            reader.fieldnames = [(f or "").strip().lower() for f in (reader.fieldnames or [])]
            print(f"columns: {', '.join(reader.fieldnames[:12])}{' …' if len(reader.fieldnames) > 12 else ''}\n")

            for raw in reader:
                seen += 1
                mapped = map_row({(k or "").strip().lower(): v for k, v in raw.items()})
                if mapped is None:
                    skipped += 1
                else:
                    batch.append(mapped)

                if len(batch) >= 2000:
                    kept += await flush(session, batch)
                    batch.clear()
                    print(f"  {seen:,} read / {kept:,} loaded", end="\r")
                if limit and seen >= limit:
                    break

            if batch:
                kept += await flush(session, batch)

        total = (await session.execute(select(func.count(DldTransaction.id)))).scalar_one()
        span = (
            await session.execute(
                select(func.min(DldTransaction.transaction_date), func.max(DldTransaction.transaction_date))
            )
        ).one()

    print(f"\n\nread {seen:,} rows · loaded {kept:,} · skipped {skipped:,} (missing date/price/area)")
    print(f"dld_transactions now holds {total:,} rows")
    if span[0]:
        print(f"covering {span[0]:%Y-%m-%d} to {span[1]:%Y-%m-%d}")


async def flush(session, batch: list[dict]) -> int:
    """Insert, ignoring rows whose DLD id is already present.

    ON CONFLICT DO NOTHING makes re-running the script safe — load a fresh
    monthly export over the top and only new transactions land.
    """
    rows = [r for r in batch if r["external_id"]]
    anon = [r for r in batch if not r["external_id"]]

    if rows:
        await session.execute(
            pg_insert(DldTransaction).values(rows).on_conflict_do_nothing(index_elements=["external_id"])
        )
    if anon:
        # No id to dedupe on — insert as-is.
        await session.execute(pg_insert(DldTransaction).values(anon))
    await session.commit()
    return len(batch)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    cap = None
    if "--limit" in sys.argv:
        cap = int(sys.argv[sys.argv.index("--limit") + 1])
    asyncio.run(main(sys.argv[1], cap))
