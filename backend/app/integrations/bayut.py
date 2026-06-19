"""RapidAPI 'Bayut' integration — pull real Dubai listings into our Property model.

Free tier at rapidapi.com → search "Bayut" (ApiDojo) → subscribe → copy the key into
RAPIDAPI_KEY. NOTE: this is an *unofficial* API (mirrors the portal); fine for dev/demo,
but use official agency feeds / DLD data for a paid commercial product (see
docs/property-data-apis.md).
"""
import httpx

from app.config import get_settings

settings = get_settings()
SQM_TO_SQFT = 10.7639


def _headers() -> dict:
    return {
        "X-RapidAPI-Key": settings.rapidapi_key,
        "X-RapidAPI-Host": settings.rapidapi_bayut_host,
    }


def _base() -> str:
    return f"https://{settings.rapidapi_bayut_host}"


async def resolve_location_id(client: httpx.AsyncClient, query: str) -> str:
    """Turn an area name into a Bayut locationExternalID. Defaults to Dubai (5002)."""
    if not query or query.strip().lower() == "dubai":
        return "5002"
    resp = await client.get(
        f"{_base()}/auto-complete",
        params={"query": query, "hitsPerPage": 1, "page": 0, "lang": "en"},
        headers=_headers(),
        timeout=30,
    )
    resp.raise_for_status()
    hits = resp.json().get("hits", [])
    return str(hits[0]["externalID"]) if hits else "5002"


async def fetch_listings(
    client: httpx.AsyncClient, location_id: str, purpose: str, page: int
) -> list[dict]:
    resp = await client.get(
        f"{_base()}/properties/list",
        params={
            "locationExternalIDs": location_id,
            "purpose": purpose,
            "hitsPerPage": 25,
            "page": page,
            "lang": "en",
            "sort": "city-level-score",
            "categoryExternalID": 4,  # residential
        },
        headers=_headers(),
        timeout=45,
    )
    resp.raise_for_status()
    return resp.json().get("hits", [])


def _pick_type(hit: dict) -> str:
    cats = " ".join(c.get("slug", "") + " " + c.get("name", "") for c in hit.get("category", [])).lower()
    title = (hit.get("title") or "").lower()
    if "villa" in cats:
        return "Villa"
    if "townhouse" in cats:
        return "Townhouse"
    if "penthouse" in cats or "penthouse" in title:
        return "Penthouse"
    return "Apartment"


def _pick_location(hit: dict) -> str:
    names = [loc.get("name") for loc in hit.get("location", []) if loc.get("name")]
    # Drop country/emirate; the most specific community is usually last.
    specific = [n for n in names if n not in ("UAE", "United Arab Emirates", "Dubai")]
    return (specific[-1] if specific else (names[-1] if names else "Dubai"))


def map_hit_to_property(hit: dict, agency_id: int | None) -> dict | None:
    """Map a Bayut hit to our Property fields. Returns None if essential data missing."""
    price = hit.get("price")
    if not price:
        return None
    area_sqm = hit.get("area") or 0
    size_sqft = int(round(float(area_sqm) * SQM_TO_SQFT)) if area_sqm else 0
    cover = (hit.get("coverPhoto") or {}).get("url")
    completion = (hit.get("completionStatus") or "").lower()

    return {
        "agency_id": agency_id,
        "external_id": str(hit.get("externalID") or hit.get("id") or ""),
        "source": "bayut",
        "location": _pick_location(hit),
        "building": (hit.get("title") or "Listing")[:160],
        "price": float(price),
        "type": _pick_type(hit),
        "bedrooms": int(hit.get("rooms") or 0),
        "size_sqft": size_sqft,
        "has_pool": False,
        "has_gym": False,
        "has_balcony": False,
        "available": True,
        "possession": "Ready" if completion == "completed" else "Off-Plan",
        "image_url": cover,
    }
