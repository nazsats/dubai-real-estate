"""Property CRUD + filtered listing (tenant-scoped: own listings + shared pool)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.broker_agent import fetch_properties
from app.api.deps import get_current_user
from app.db import get_session
from app.models import Property, User
from app.schemas import PropertyCreate, PropertyOut

router = APIRouter(prefix="/api/properties", tags=["properties"])


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
