"""One-shot demo data generator: add N random leads to the demo agency.

Run from the backend/ folder (with the venv active):

    python generate_leads.py            # 10,000 leads (default)
    python generate_leads.py 2000       # custom count

Safe to run multiple times (it appends). Uses the same DATABASE_URL as the app.
"""
import asyncio
import random
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import Agency, Lead, User

# ── Realistic Dubai-market variety ────────────────────────────
FIRST = [
    "Ahmed", "Mohammed", "Omar", "Khalid", "Fatima", "Aisha", "Sara", "Layla", "Yousef", "Hassan",
    "Raj", "Priya", "Arjun", "Anjali", "Vikram", "Neha", "Rohan", "Deepa",
    "John", "Emma", "David", "Sophie", "James", "Olivia", "Michael", "Grace",
    "Ivan", "Natasha", "Dmitry", "Elena", "Sergei", "Olga",
    "Wei", "Li", "Chen", "Mei", "Jin", "Hiroshi", "Yuki",
    "Hamad", "Saeed", "Mariam", "Noura", "Reem", "Tariq", "Bilal", "Zainab",
]
LAST = [
    "Al Maktoum", "Al Nahyan", "Khan", "Sharma", "Patel", "Singh", "Smith", "Johnson",
    "Brown", "Ivanov", "Petrov", "Wang", "Zhang", "Liu", "Hassan", "Rahman",
    "Abdullah", "Al Rashid", "Hussain", "Malik", "Kapoor", "Nair", "Williams", "Volkov",
]
LANGUAGES = ["English", "English", "English", "Arabic", "Arabic", "Russian", "Hindi", "Chinese", "Farsi"]
SOURCES = ["portal", "portal", "whatsapp", "whatsapp", "web", "referral", "walk-in", "instagram", "telegram"]
# Weighted pipeline distribution (most leads early-stage, like real life)
STAGES = (
    ["New"] * 30 + ["Contacted"] * 22 + ["Qualified"] * 16 + ["Viewing"] * 10
    + ["Negotiation"] * 7 + ["Won"] * 8 + ["Lost"] * 7
)
TYPES = ["Apartment", "Apartment", "Villa", "Townhouse", "Penthouse"]
AREAS = [
    "Dubai Marina", "Downtown Dubai", "Palm Jumeirah", "Dubai Hills Estate", "Business Bay",
    "Jumeirah Village Circle", "Arabian Ranches", "Emirates Hills", "Jumeirah Beach Residence",
    "Dubai Creek Harbour", "Al Furjan", "Meydan", "Dubai South", "JLT",
]
NOTES = [
    "Looking for a sea view.", "Cash buyer, ready to move fast.", "Needs mortgage pre-approval.",
    "Investor — wants high ROI.", "Golden visa eligible (2M+).", "Relocating from abroad.",
    "Prefers high floor.", "Family with kids — needs schools nearby.", "First-time buyer.",
    "Wants handover within 6 months.", None, None,
]


def _phone() -> str:
    return "+9715" + "".join(str(random.randint(0, 9)) for _ in range(8))


def _make_lead(agency_id: int, owner_id: int | None) -> Lead:
    first, last = random.choice(FIRST), random.choice(LAST)
    bmax = random.choice([800_000, 1_200_000, 1_800_000, 2_500_000, 3_500_000, 5_000_000, 8_000_000, 15_000_000])
    areas = random.sample(AREAS, k=random.randint(1, 2))
    created = datetime.now(timezone.utc) - timedelta(
        days=random.randint(0, 120), hours=random.randint(0, 23), minutes=random.randint(0, 59)
    )
    return Lead(
        agency_id=agency_id,
        owner_id=owner_id,
        name=f"{first} {last}",
        email=f"{first}.{last}{random.randint(1, 9999)}".replace(" ", "").lower() + "@example.com",
        phone=_phone(),
        whatsapp=_phone(),
        language=random.choice(LANGUAGES),
        source=random.choice(SOURCES),
        status=random.choice(STAGES),
        score=random.choice([0, 0, 10, 25, 40, 55, 70, 80, 90, 100]),
        budget_min=round(bmax * 0.6),
        budget_max=bmax,
        preferred_locations=", ".join(areas),
        bedrooms=random.choice([0, 1, 1, 2, 2, 3, 3, 4, 5]),
        property_type=random.choice(TYPES),
        notes=random.choice(NOTES),
        created_at=created,
    )


async def main(count: int) -> None:
    async with SessionLocal() as session:
        agency = (await session.execute(select(Agency).where(Agency.slug == "demo"))).scalar_one_or_none()
        if agency is None:
            print("No 'demo' agency found. Start the backend once first (it seeds the demo agency).")
            return
        admin = (
            await session.execute(select(User).where(User.agency_id == agency.id).limit(1))
        ).scalar_one_or_none()
        owner_id = admin.id if admin else None

        before = (
            await session.execute(select(func.count(Lead.id)).where(Lead.agency_id == agency.id))
        ).scalar_one()

        # Insert in batches so memory + commit stay reasonable.
        BATCH = 1000
        for start in range(0, count, BATCH):
            n = min(BATCH, count - start)
            session.add_all([_make_lead(agency.id, owner_id) for _ in range(n)])
            await session.commit()
            print(f"  inserted {start + n}/{count}")

        total = (
            await session.execute(select(func.count(Lead.id)).where(Lead.agency_id == agency.id))
        ).scalar_one()
        print(f"\nDone. Added {count} leads (was {before}, now {total}) to agency '{agency.name}'.")


if __name__ == "__main__":
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 10_000
    asyncio.run(main(count))
