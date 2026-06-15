"""Seed a demo agency + realistic Dubai properties so the app is usable on first run.

Ported and cleaned up from the legacy generator. Properties are seeded into the
shared pool (agency_id = NULL) so every tenant sees baseline inventory. Replaced
by real listing feeds in Phase 7.
"""
import random

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Agency, Property, User
from app.security import hash_password

settings = get_settings()

DEMO_EMAIL = "demo@demo.ae"
DEMO_PASSWORD = "demo12345"

LOCATION_BUILDINGS = {
    "Dubai Marina": ["Marina Gate", "Princess Tower", "Cayan Tower", "Marina Promenade", "Silverene"],
    "Downtown Dubai": ["Burj Khalifa", "Address Downtown", "Standpoint", "The Residences", "Boulevard Point"],
    "Palm Jumeirah": ["Oceana", "Tiara", "Shoreline", "Signature Villas", "Garden Homes"],
    "Dubai Hills Estate": ["Maple", "Sidra", "Park Heights", "Mulberry", "Golf Place"],
    "Business Bay": ["Executive Towers", "Merano Tower", "DAMAC Towers", "The Opus", "Churchill Towers"],
    "Jumeirah Village Circle": ["Seasons Community", "District 10", "Bloom Towers", "Five JVC", "Belgravia"],
    "Arabian Ranches": ["Al Reem", "Saheel", "Mirador", "Alma", "Savannah"],
    "Emirates Hills": ["Sector E", "Sector L", "Sector V", "Sector W", "Sector P"],
}
FALLBACK_LOCATIONS = [
    "Jumeirah Beach Residence", "Dubai Creek Harbour", "Al Furjan", "Meydan",
    "Dubai South", "Dubai Silicon Oasis", "Al Barsha", "JLT",
]
TYPES = ["Apartment", "Villa", "Townhouse", "Penthouse"]
POSSESSIONS = ["Ready", "Q1 2026", "Q2 2026", "Q3 2026", "Under Construction", "Q4 2025"]


def _random_property() -> dict:
    if random.random() < 0.7:
        loc = random.choice(list(LOCATION_BUILDINGS))
        building = random.choice(LOCATION_BUILDINGS[loc])
    else:
        loc = random.choice(FALLBACK_LOCATIONS)
        building = f"Generic {loc} Building"

    ptype = random.choice(TYPES)
    if ptype == "Villa":
        bedrooms, size = random.randint(4, 7), random.randint(3500, 12000)
        price = random.randint(7_000_000, 65_000_000)
        pool, gym, balcony = random.random() < 0.9, False, True
    elif ptype == "Penthouse":
        bedrooms, size = random.randint(3, 6), random.randint(3000, 8000)
        price = random.randint(9_000_000, 50_000_000)
        pool, gym, balcony = True, True, True
    elif ptype == "Townhouse":
        bedrooms, size = random.randint(3, 5), random.randint(2000, 4000)
        price = random.randint(2_800_000, 14_000_000)
        pool, gym, balcony = random.random() < 0.4, random.random() < 0.3, True
    else:  # Apartment
        bedrooms, size = random.randint(1, 4), random.randint(600, 2500)
        price = random.randint(800_000, 18_000_000)
        pool, gym, balcony = random.random() < 0.8, random.random() < 0.85, random.random() < 0.7

    return {
        "location": loc,
        "building": building,
        "price": round(price / 50_000) * 50_000,
        "type": ptype,
        "bedrooms": bedrooms,
        "size_sqft": size,
        "has_pool": pool,
        "has_gym": gym,
        "has_balcony": balcony,
        "available": random.random() < 0.8,
        "possession": random.choice(POSSESSIONS),
    }


async def seed_if_empty(session: AsyncSession) -> None:
    # Ensure a demo agency + admin user exist so you can log in immediately.
    demo = (await session.execute(select(Agency).where(Agency.slug == "demo"))).scalar_one_or_none()
    if demo is None:
        demo = Agency(name="Demo Realty", slug="demo")
        session.add(demo)
        await session.flush()

    demo_user = (await session.execute(select(User).where(User.email == DEMO_EMAIL))).scalar_one_or_none()
    if demo_user is None:
        session.add(
            User(
                agency_id=demo.id,
                email=DEMO_EMAIL,
                full_name="Demo Admin",
                hashed_password=hash_password(DEMO_PASSWORD),
                role="admin",
            )
        )
    await session.commit()

    count = (await session.execute(select(func.count(Property.id)))).scalar_one()
    if count >= settings.seed_property_count:
        return

    needed = settings.seed_property_count - count
    session.add_all([Property(**_random_property()) for _ in range(needed)])
    await session.commit()
