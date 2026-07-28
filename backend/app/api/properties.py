"""Property CRUD + filtered listing (tenant-scoped: own listings + shared pool)."""
import csv
import io

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.broker_agent import fetch_properties
from app.api.deps import get_current_user, require_admin
from app.config import get_settings
from app.db import get_session
from app.integrations import bayut
from app.models import Property, User
from app.schemas import BayutImportRequest, BayutImportResult, PropertyCreate, PropertyOut

router = APIRouter(prefix="/api/properties", tags=["properties"])
settings = get_settings()


@router.get("", response_model=list[PropertyOut])
async def list_properties(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    location: str | None = None,
    property_type: str | None = None,
    min_bedrooms: int | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    limit: int = Query(24, le=50),
):
    return await fetch_properties(
        session,
        user.agency_id,
        location=location,
        property_type=property_type,
        min_bedrooms=min_bedrooms,
        min_price=min_price,
        max_price=max_price,
        limit=limit,
    )


@router.post("", response_model=PropertyOut, status_code=201)
async def create_property(
    body: PropertyCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    prop = Property(agency_id=user.agency_id, **body.model_dump())
    session.add(prop)
    await session.commit()
    await session.refresh(prop)
    return prop


@router.post("/import/bayut", response_model=BayutImportResult)
async def import_from_bayut(
    body: BayutImportRequest,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Pull real Dubai listings from the RapidAPI Bayut API into this agency's inventory."""
    if not settings.rapidapi_key:
        raise HTTPException(400, "RAPIDAPI_KEY not set — add it to backend/.env (free key at rapidapi.com).")

    target_agency = None if body.to_shared_pool else admin.agency_id
    imported = skipped = fetched = 0

    async with httpx.AsyncClient() as client:
        try:
            location_id = await bayut.resolve_location_id(client, body.location)
            mapped: list[dict] = []
            for page in range(max(1, min(body.pages, 10))):
                hits = await bayut.fetch_listings(client, location_id, body.purpose, page)
                if not hits:
                    break
                fetched += len(hits)
                for hit in hits:
                    row = bayut.map_hit_to_property(hit, target_agency)
                    if row:
                        mapped.append(row)
        except httpx.HTTPStatusError as exc:
            raise HTTPException(502, f"Bayut API error: {exc.response.status_code}")
        except httpx.HTTPError as exc:
            raise HTTPException(502, f"Bayut request failed: {exc}")

    # The API only has location IDs for a couple of areas; everything else is
    # fetched Dubai-wide. Filter the mapped rows to the requested community by
    # name so "Dubai Marina" imports Marina listings — previously the whole
    # city came back silently regardless of what the agent typed.
    area = bayut.normalize_area(body.location)
    if area and area != "dubai" and location_id == bayut.DUBAI_LOCATION_ID:
        mapped = [r for r in mapped if area in (r["location"] or "").lower()]
        if not mapped and fetched:
            raise HTTPException(
                404,
                f"Fetched {fetched} Dubai listings but none matched '{body.location}'. "
                "Try the full community name (e.g. 'Jumeirah Village Circle') or more pages.",
            )

    # Dedupe against already-imported external IDs.
    ext_ids = [r["external_id"] for r in mapped if r["external_id"]]
    existing: set[str] = set()
    if ext_ids:
        rows = await session.execute(select(Property.external_id).where(Property.external_id.in_(ext_ids)))
        existing = {e for (e,) in rows.all()}

    for row in mapped:
        if row["external_id"] and row["external_id"] in existing:
            skipped += 1
            continue
        session.add(Property(**row))
        existing.add(row["external_id"])
        imported += 1

    await session.commit()
    return BayutImportResult(location=body.location, imported=imported, skipped=skipped, fetched=fetched)


CSV_COLUMNS = [
    "location", "building", "price", "type", "bedrooms", "size_sqft",
    "has_pool", "has_gym", "has_balcony", "possession", "image_url",
]


@router.get("/import/csv/template")
async def csv_template(_: User = Depends(get_current_user)):
    """Download a CSV template with the expected columns + one example row."""
    from fastapi.responses import PlainTextResponse

    example = "Dubai Marina,Marina Gate,2500000,Apartment,2,1200,true,true,true,Ready,"
    body = ",".join(CSV_COLUMNS) + "\n" + example + "\n"
    return PlainTextResponse(
        body, headers={"Content-Disposition": "attachment; filename=listings_template.csv"}
    )


def _as_bool(v: str | None) -> bool:
    return str(v or "").strip().lower() in ("1", "true", "yes", "y", "t")


def _as_num(v: str | None) -> float | None:
    try:
        return float(str(v).replace(",", "").strip())
    except (TypeError, ValueError):
        return None


@router.post("/import/csv", response_model=BayutImportResult)
async def import_from_csv(
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Import an agency's own listings from a CSV (the legal per-agency path).

    Columns (header row required): location, building, price, type, bedrooms,
    size_sqft, [has_pool, has_gym, has_balcony, possession, image_url].
    """
    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(400, "File must be UTF-8 encoded CSV")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(400, "Empty or invalid CSV")
    # Normalize headers to lowercase for forgiving matching.
    norm = {f: (f or "").strip().lower() for f in reader.fieldnames}

    imported = skipped = fetched = 0
    for row in reader:
        fetched += 1
        data = {norm[k]: v for k, v in row.items() if k in norm}
        price = _as_num(data.get("price"))
        if not data.get("location") or not price:
            skipped += 1
            continue
        session.add(
            Property(
                agency_id=admin.agency_id,
                source="csv",
                location=str(data.get("location")).strip(),
                building=str(data.get("building") or data.get("location")).strip()[:160],
                price=price,
                type=(str(data.get("type") or "Apartment").strip().title()),
                bedrooms=int(_as_num(data.get("bedrooms")) or 0),
                size_sqft=int(_as_num(data.get("size_sqft")) or 0),
                has_pool=_as_bool(data.get("has_pool")),
                has_gym=_as_bool(data.get("has_gym")),
                has_balcony=_as_bool(data.get("has_balcony")),
                available=True,
                possession=str(data.get("possession") or "Ready").strip(),
                image_url=(data.get("image_url") or None),
            )
        )
        imported += 1

    await session.commit()
    return BayutImportResult(location=file.filename or "csv", imported=imported, skipped=skipped, fetched=fetched)


@router.get("/{property_id}", response_model=PropertyOut)
async def get_property(
    property_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    prop = await session.get(Property, property_id)
    if prop is None or (prop.agency_id is not None and prop.agency_id != user.agency_id):
        raise HTTPException(404, "Property not found")
    return prop
