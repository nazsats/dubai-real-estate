"""Deals + revenue/commission tracking."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db import get_session
from app.models import DEAL_STAGES, Deal, User
from app.schemas import DealCreate, DealOut, DealUpdate, RevenueSummary

router = APIRouter(prefix="/api/deals", tags=["deals"])


async def _get_owned_deal(deal_id: int, user: User, session: AsyncSession) -> Deal:
    deal = await session.get(Deal, deal_id)
    if deal is None or deal.agency_id != user.agency_id:
        raise HTTPException(404, "Deal not found")
    return deal


@router.get("", response_model=list[DealOut])
async def list_deals(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    stage: str | None = None,
):
    stmt = select(Deal).where(Deal.agency_id == user.agency_id)
    if stage:
        stmt = stmt.where(Deal.stage == stage)
    stmt = stmt.order_by(Deal.created_at.desc())
    return list((await session.execute(stmt)).scalars().all())


@router.post("", response_model=DealOut, status_code=201)
async def create_deal(
    body: DealCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if body.stage not in DEAL_STAGES:
        raise HTTPException(400, f"stage must be one of {DEAL_STAGES}")
    deal = Deal(agency_id=user.agency_id, **body.model_dump())
    session.add(deal)
    await session.commit()
    await session.refresh(deal)
    return deal


@router.get("/summary", response_model=RevenueSummary)
async def revenue_summary(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    """Headline revenue numbers for the agency dashboard."""
    deals = list(
        (await session.execute(select(Deal).where(Deal.agency_id == user.agency_id))).scalars().all()
    )
    open_deals = [d for d in deals if d.stage == "Negotiation"]
    won = [d for d in deals if d.stage == "Won"]
    lost = [d for d in deals if d.stage == "Lost"]
    return RevenueSummary(
        open_deals=len(open_deals),
        won_deals=len(won),
        lost_deals=len(lost),
        pipeline_value=float(sum(float(d.value) for d in open_deals)),
        won_value=float(sum(float(d.value) for d in won)),
        commission_won=float(sum(float(d.commission) for d in won)),
        commission_pending=float(sum(float(d.commission) for d in won if d.payment_status != "Paid")),
    )


@router.patch("/{deal_id}", response_model=DealOut)
async def update_deal(
    deal_id: int,
    body: DealUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    deal = await _get_owned_deal(deal_id, user, session)
    changes = body.model_dump(exclude_unset=True)
    if "stage" in changes:
        if changes["stage"] not in DEAL_STAGES:
            raise HTTPException(400, f"stage must be one of {DEAL_STAGES}")
        # Stamp the close date when a deal is won or lost.
        if changes["stage"] in ("Won", "Lost") and deal.closed_at is None:
            deal.closed_at = datetime.now(timezone.utc)
    for field, value in changes.items():
        setattr(deal, field, value)
    await session.commit()
    await session.refresh(deal)
    return deal


@router.delete("/{deal_id}", status_code=204)
async def delete_deal(
    deal_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    deal = await _get_owned_deal(deal_id, user, session)
    await session.delete(deal)
    await session.commit()
