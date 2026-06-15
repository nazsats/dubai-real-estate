"""Lead CRUD + pipeline moves + interaction timeline (the CRM core)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db import get_session
from app.models import LEAD_STAGES, Interaction, Lead, User
from app.schemas import (
    InteractionCreate,
    InteractionOut,
    LeadCreate,
    LeadOut,
    LeadUpdate,
)

router = APIRouter(prefix="/api/leads", tags=["leads"])


async def _get_owned_lead(lead_id: int, user: User, session: AsyncSession) -> Lead:
    lead = await session.get(Lead, lead_id)
    if lead is None or lead.agency_id != user.agency_id:
        raise HTTPException(404, "Lead not found")
    return lead


@router.get("", response_model=list[LeadOut])
async def list_leads(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    status: str | None = None,
    owner_id: int | None = None,
):
    stmt = select(Lead).where(Lead.agency_id == user.agency_id)
    if status:
        stmt = stmt.where(Lead.status == status)
    if owner_id is not None:
        stmt = stmt.where(Lead.owner_id == owner_id)
    stmt = stmt.order_by(Lead.created_at.desc())
    return list((await session.execute(stmt)).scalars().all())


@router.post("", response_model=LeadOut, status_code=201)
async def create_lead(
    body: LeadCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if body.status not in LEAD_STAGES:
        raise HTTPException(400, f"status must be one of {LEAD_STAGES}")
    lead = Lead(agency_id=user.agency_id, **body.model_dump())
    session.add(lead)
    await session.commit()
    await session.refresh(lead)
    return lead


@router.get("/{lead_id}", response_model=LeadOut)
async def get_lead(
    lead_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await _get_owned_lead(lead_id, user, session)


@router.patch("/{lead_id}", response_model=LeadOut)
async def update_lead(
    lead_id: int,
    body: LeadUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Edit a lead — including moving its pipeline `status`."""
    lead = await _get_owned_lead(lead_id, user, session)
    changes = body.model_dump(exclude_unset=True)
    if "status" in changes and changes["status"] not in LEAD_STAGES:
        raise HTTPException(400, f"status must be one of {LEAD_STAGES}")
    for field, value in changes.items():
        setattr(lead, field, value)
    await session.commit()
    await session.refresh(lead)
    return lead


@router.delete("/{lead_id}", status_code=204)
async def delete_lead(
    lead_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    lead = await _get_owned_lead(lead_id, user, session)
    await session.delete(lead)
    await session.commit()


# ── Interaction timeline ──────────────────────────────────────
@router.get("/{lead_id}/interactions", response_model=list[InteractionOut])
async def list_interactions(
    lead_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await _get_owned_lead(lead_id, user, session)
    rows = await session.execute(
        select(Interaction).where(Interaction.lead_id == lead_id).order_by(Interaction.created_at.desc())
    )
    return list(rows.scalars().all())


@router.post("/{lead_id}/interactions", response_model=InteractionOut, status_code=201)
async def add_interaction(
    lead_id: int,
    body: InteractionCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await _get_owned_lead(lead_id, user, session)
    interaction = Interaction(
        agency_id=user.agency_id,
        lead_id=lead_id,
        user_id=user.id,
        channel=body.channel,
        direction=body.direction,
        body=body.body,
    )
    session.add(interaction)
    await session.commit()
    await session.refresh(interaction)
    return interaction
