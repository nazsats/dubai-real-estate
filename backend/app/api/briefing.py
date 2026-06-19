"""Daily briefing — the 'AI sales manager' / follow-up engine.

100% rule-based (NO AI tokens): it inspects leads, their last touchpoint, and
tasks to tell the agent exactly who to act on today. The only optional AI is a
separate, on-demand 'draft follow-up' endpoint.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db import get_session
from app.models import Interaction, Lead, Task, User

router = APIRouter(prefix="/api/briefing", tags=["briefing"])

# How long a lead can sit untouched (by stage) before a follow-up is "due".
STAGE_THRESHOLD_DAYS = {"New": 1, "Contacted": 2, "Qualified": 3, "Viewing": 2, "Negotiation": 2}
DEFAULT_THRESHOLD = 3
COLD_DAYS = 7
CLOSED = ("Won", "Lost")


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


@router.get("/today")
async def today(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    now = datetime.now(timezone.utc)

    # Active leads (exclude Won/Lost)
    leads = list(
        (
            await session.execute(
                select(Lead).where(Lead.agency_id == user.agency_id, Lead.status.notin_(CLOSED))
            )
        )
        .scalars()
        .all()
    )

    # Last touch time per lead (one grouped query — no per-lead round trips)
    touch_rows = (
        await session.execute(
            select(Interaction.lead_id, func.max(Interaction.created_at))
            .where(Interaction.agency_id == user.agency_id)
            .group_by(Interaction.lead_id)
        )
    ).all()
    last_touch = {lead_id: _aware(ts) for lead_id, ts in touch_rows}

    follow_ups, going_cold = [], []
    for lead in leads:
        touched = last_touch.get(lead.id)
        ref = touched or _aware(lead.created_at) or now
        days = max((now - ref).days, 0)
        threshold = STAGE_THRESHOLD_DAYS.get(lead.status, DEFAULT_THRESHOLD)
        reason = (
            f"No reply in {days}d" if touched else f"Never contacted · {days}d old"
        )
        item = {
            "lead_id": lead.id,
            "name": lead.name,
            "status": lead.status,
            "score": lead.score,
            "days_since_touch": days,
            "contacted": touched is not None,
            "reason": reason,
            "budget_max": float(lead.budget_max) if lead.budget_max else None,
        }
        if days >= threshold:
            follow_ups.append(item)
        if days >= COLD_DAYS:
            going_cold.append(item)

    follow_ups.sort(key=lambda x: x["days_since_touch"], reverse=True)
    going_cold.sort(key=lambda x: x["days_since_touch"], reverse=True)

    # Hottest active leads by score
    hot_leads = sorted(
        (
            {"lead_id": l.id, "name": l.name, "status": l.status, "score": l.score,
             "budget_max": float(l.budget_max) if l.budget_max else None}
            for l in leads
            if l.score > 0
        ),
        key=lambda x: x["score"],
        reverse=True,
    )[:5]

    # Tasks due today / overdue
    end_of_day = now.replace(hour=23, minute=59, second=59, microsecond=0)
    task_rows = list(
        (
            await session.execute(
                select(Task)
                .where(
                    Task.agency_id == user.agency_id,
                    Task.done.is_(False),
                    Task.due_at.is_not(None),
                    Task.due_at <= end_of_day,
                )
                .order_by(Task.due_at)
            )
        )
        .scalars()
        .all()
    )
    tasks_today = [
        {
            "id": t.id,
            "title": t.title,
            "lead_id": t.lead_id,
            "due_at": t.due_at.isoformat() if t.due_at else None,
            "overdue": bool(_aware(t.due_at) and _aware(t.due_at) < now),
        }
        for t in task_rows
    ]

    return {
        "generated_at": now.isoformat(),
        "stats": {
            "follow_ups": len(follow_ups),
            "hot": len(hot_leads),
            "going_cold": len(going_cold),
            "tasks_today": len(tasks_today),
            "active_leads": len(leads),
        },
        "follow_ups": follow_ups[:20],
        "hot_leads": hot_leads,
        "going_cold": going_cold[:10],
        "tasks_today": tasks_today,
    }
