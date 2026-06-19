"""Pipeline board — leads grouped by stage (kanban data).

Returns full per-stage counts but only the most recent N leads per column, so the
board stays fast even with thousands of leads.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db import get_session
from app.models import LEAD_STAGES, Lead, User
from app.schemas import LeadOut

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])

PER_STAGE = 25  # cards loaded per column


@router.get("")
async def get_pipeline(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    """Leads grouped by stage (capped per column) + accurate full counts."""
    # Full counts per stage (cheap aggregate, not affected by the per-column cap).
    count_rows = (
        await session.execute(
            select(Lead.status, func.count(Lead.id))
            .where(Lead.agency_id == user.agency_id)
            .group_by(Lead.status)
        )
    ).all()
    counts = {stage: 0 for stage in LEAD_STAGES}
    for status, n in count_rows:
        counts[status] = n

    # Most recent N leads per stage for display.
    board: dict[str, list[LeadOut]] = {}
    for stage in LEAD_STAGES:
        rows = await session.execute(
            select(Lead)
            .where(Lead.agency_id == user.agency_id, Lead.status == stage)
            .order_by(Lead.created_at.desc())
            .limit(PER_STAGE)
        )
        board[stage] = [LeadOut.model_validate(l) for l in rows.scalars().all()]

    return {
        "stages": list(LEAD_STAGES),
        "counts": counts,
        "board": board,
        "per_stage": PER_STAGE,
    }
