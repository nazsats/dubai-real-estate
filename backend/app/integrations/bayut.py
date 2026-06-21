"""RapidAPI 'Byut API' integration — pull real Dubai listings into our Property model.

Subscribe on rapidapi.com (host ``byut-api.p.rapidapi.com``) → copy the key into
RAPIDAPI_KEY. NOTE: this is an *unofficial* API (mirrors the Bayut portal); fine for
dev/demo, but use official agency feeds / DLD data for a paid commercial product (see
docs/property-data-apis.md).

This API has no location autocomplete endpoint, but it uses Bayut's standard
locationExternalID space (Dubai city-wide = 5002), so we resolve area names from a
small static map and fall back to Dubai-wide — the mapper then derives each listing's
specific community from its own location data.
"""
import httpx

from app.config import get_settings

settings = get_settings()
SQM_TO_SQFT = 10.7639
DUBAI_LOCATION_ID = "5002"

# Standard Bayut locationExternalIDs for popular Dubai communities. Anything not listed
# falls back to Dubai city-wide (5002), which still returns that area's listings mixed
# with the rest of the city.
AREA_LOCATION_IDS = {
    "dubai": "5002",
    "downtown dubai": "6901",
}


def _headers() -> dict:
    return {
        "X-RapidAPI-Key": settings.rapidapi_key,
        "X-RapidAPI-Host": settings.rapidapi_bayut_host,
    }


def _base() -> str:
    return f"https://{settings.rapidapi_bayut_host}"


async def resolve_location_id(client: httpx.AsyncClient, query: str) -> str:
    """Map an area name to a Bayut locationExternalID. Defaults to Dubai (5002)."""
    return AREA_LOCATION_IDS.get((query or "").strip().lower(), DUBAI_LOCATION_ID)


async def fetch_listings(
    client: httpx.AsyncClient, location_id: str, purpose: str, page: int
) -> list[dict]:
    resp = await client.get(
        f"{_base()}/search/property",
        params={
            "location_external_id": location_id,
            "purpose": purpose,
            "hitsPerPage": 25,
            "page": page,
            "category": "residential",
        },
        headers=_headers(),
        timeout=45,
    )
    resp.raise_for_status()
    # This API wraps results: {"message": ..., "status_code": ..., "datan": {"hits": [...]}}
    return resp.json().get("datan", {}).get("hits", [])


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
