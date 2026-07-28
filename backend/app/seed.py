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

# Curated, stable Unsplash photos per type so seeded demo listings show real imagery
# (the seed has no live feed). Replaced by actual cover photos on Bayut/CSV import.
STOCK_IMAGES = {
    "Apartment": [
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=70",
        "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=70",
        "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=70",
    ],
    "Villa": [
        "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=70",
        "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=70",
        "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=70",
    ],
    "Townhouse": [
        "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=70",
        "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800&q=70",
        "https://images.unsplash.com/photo-1576941089067-2de3c901e126?w=800&q=70",
    ],
    "Penthouse": [
        "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=70",
        "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=70",
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=70",
    ],
}


# Rough price tier per area, as a multiplier on the base price for a type.
# Without this the generator picked type uniformly for every location, so
# 60M villas landed in budget communities and every area averaged ~20M — which
# made the dashboard's price map a single flat colour and "Al Furjan: AED 24M"
# a straight-faced lie. Tiers keep the synthetic data directionally honest.
AREA_TIER = {
    "Palm Jumeirah": 3.4,
    "Emirates Hills": 3.2,
    "Downtown Dubai": 1.9,
    "Dubai Marina": 1.5,
    "Jumeirah Beach Residence": 1.45,
    "Dubai Creek Harbour": 1.3,
    "Dubai Hills Estate": 1.25,
    "Arabian Ranches": 1.2,
    "Meydan": 1.1,
    "Business Bay": 1.0,
    "JLT": 0.85,
    "Al Barsha": 0.8,
    "Al Furjan": 0.7,
    "Jumeirah Village Circle": 0.65,
    "Dubai Silicon Oasis": 0.6,
    "Dubai South": 0.55,
}

# Villas/penthouses concentrate in the prime + suburban-villa areas; the dense
# towers are overwhelmingly apartments.
VILLA_AREAS = {"Palm Jumeirah", "Emirates Hills", "Arabian Ranches", "Dubai Hills Estate", "Meydan"}


def _type_for(loc: str) -> str:
    if loc in VILLA_AREAS:
        return random.choices(TYPES, weights=[20, 45, 30, 5])[0]  # mostly villas/townhouses
    return random.choices(TYPES, weights=[82, 2, 8, 8])[0]  # towers -> apartments


def _random_property() -> dict:
    if random.random() < 0.7:
        loc = random.choice(list(LOCATION_BUILDINGS))
        building = random.choice(LOCATION_BUILDINGS[loc])
    else:
        loc = random.choice(FALLBACK_LOCATIONS)
        building = f"Generic {loc} Building"

    ptype = _type_for(loc)
    tier = AREA_TIER.get(loc, 1.0)

    if ptype == "Villa":
        bedrooms, size = random.randint(4, 7), random.randint(3500, 12000)
        price = random.randint(4_000_000, 14_000_000)
        pool, gym, balcony = random.random() < 0.9, False, True
    elif ptype == "Penthouse":
        bedrooms, size = random.randint(3, 6), random.randint(3000, 8000)
        price = random.randint(6_000_000, 16_000_000)
        pool, gym, balcony = True, True, True
    elif ptype == "Townhouse":
        bedrooms, size = random.randint(3, 5), random.randint(2000, 4000)
        price = random.randint(1_800_000, 5_000_000)
        pool, gym, balcony = random.random() < 0.4, random.random() < 0.3, True
    else:  # Apartment
        bedrooms, size = random.randint(1, 4), random.randint(600, 2500)
        price = random.randint(650_000, 4_500_000)
        pool, gym, balcony = random.random() < 0.8, random.random() < 0.85, random.random() < 0.7

    price = int(price * tier)

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
        "source": "seed",
        "image_url": random.choice(STOCK_IMAGES[ptype]),
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
