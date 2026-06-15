"""Pipeline board — leads grouped by stage (kanban data)."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db import get_session
from app.models import LEAD_STAGES, Lead, User
from app.schemas import LeadOut

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


@router.get("")
async def get_pipeline(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    """Return leads grouped by pipeline stage, plus per-stage counts."""
    rows = await session.execute(
        select(Lead).where(Lead.agency_id == user.agency_id).order_by(Lead.created_at.desc())
    )
    leads = list(rows.scalars().all())

    board: dict[str, list[LeadOut]] = {stage: [] for stage in LEAD_STAGES}
    for lead in leads:
        board.setdefault(lead.status, []).append(LeadOut.model_validate(lead))

    return {
        "stages": list(LEAD_STAGES),
        "counts": {stage: len(items) for stage, items in board.items()},
        "board": board,
    }
