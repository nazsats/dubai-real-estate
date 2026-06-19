"""AI endpoints — the broker brain: search, match, pitch, marketing.

All routes are tenant-scoped via the authenticated user, and rate-limited as a
runaway-spend guard.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import broker_agent
from app.ai.client import generate
from app.api.deps import get_current_user
from app.db import get_session
from app.models import Interaction, Lead, Property, User
from app.ratelimit import ai_rate_limiter
from app.schemas import (
    MarketingRequest,
    MarketingResponse,
    MatchRequest,
    PitchRequest,
    PitchResponse,
    PropertyOut,
    SearchRequest,
    SearchResponse,
)

# The rate-limit dependency runs on every AI route (runaway-spend guard).
router = APIRouter(prefix="/api/ai", tags=["ai"], dependencies=[Depends(ai_rate_limiter)])


async def _owned_lead(lead_id: int, user: User, session: AsyncSession) -> Lead:
    lead = await session.get(Lead, lead_id)
    if lead is None or lead.agency_id != user.agency_id:
        raise HTTPException(404, "Lead not found")
    return lead


@router.post("/search", response_model=SearchResponse)
async def ai_search(
    body: SearchRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Conversational property finder (Claude + a DB search tool)."""
    answer, props = await broker_agent.nl_search(session, user.agency_id, body.query, body.history)
    return SearchResponse(answer=answer, properties=[PropertyOut.model_validate(p) for p in props])


@router.post("/match")
async def ai_match(
    body: MatchRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Rank the best properties for a lead, with rationale."""
    lead = await _owned_lead(body.lead_id, user, session)
    text, props = await broker_agent.match_lead(session, lead, body.limit)
    return {"analysis": text, "properties": [PropertyOut.model_validate(p) for p in props]}


@router.post("/pitch", response_model=PitchResponse)
async def ai_pitch(
    body: PitchRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Draft a ready-to-send WhatsApp/email pitch with a tailored shortlist."""
    if body.channel not in ("whatsapp", "email"):
        raise HTTPException(400, "channel must be 'whatsapp' or 'email'")
    lead = await _owned_lead(body.lead_id, user, session)
    message, props = await broker_agent.write_pitch(session, lead, body.channel, body.limit)
    return PitchResponse(
        channel=body.channel, message=message, properties=[PropertyOut.model_validate(p) for p in props]
    )


@router.post("/marketing", response_model=MarketingResponse)
async def ai_marketing(
    body: MarketingRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Generate multi-channel marketing assets for a property (priority feature)."""
    prop = await session.get(Property, body.property_id)
    # Allow the agency's own listings or the shared pool.
    if prop is None or (prop.agency_id is not None and prop.agency_id != user.agency_id):
        raise HTTPException(404, "Property not found")
    assets = await broker_agent.marketing_pack(session, prop, body.channels)
    return MarketingResponse(property_id=prop.id, assets=assets)


class FollowupRequest(BaseModel):
    lead_id: int
    channel: str = "whatsapp"  # whatsapp | email | call


@router.post("/followup")
async def ai_followup(
    body: FollowupRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Draft a short, on-demand follow-up message for a lead.

    Intentionally cheap: uses the fast model + a tight token cap (see config),
    and only runs when the agent clicks — the daily briefing itself spends no tokens.
    """
    lead = await _owned_lead(body.lead_id, user, session)
    recent = (
        (
            await session.execute(
                select(Interaction)
                .where(Interaction.lead_id == lead.id)
                .order_by(Interaction.created_at.desc())
                .limit(4)
            )
        )
        .scalars()
        .all()
    )
    history = "\n".join(f"- [{i.channel}] {i.body[:160]}" for i in recent) or "No prior contact."
    budget = f"up to AED {int(lead.budget_max):,}" if lead.budget_max else "budget open"
    context = (
        f"Lead: {lead.name} (lang: {lead.language})\n"
        f"Stage: {lead.status} · {budget} · {lead.bedrooms or 'any'}BR · "
        f"{lead.property_type or 'any'} · areas: {lead.preferred_locations or 'open'}\n"
        f"Recent activity:\n{history}"
    )
    message = await generate(
        system=(
            f"You are a Dubai real-estate agent writing a brief, friendly {body.channel} follow-up to a "
            f"client in {lead.language}. 2-4 sentences, warm, specific to their brief, with a clear next "
            "step (book a viewing / share options). Ready to send; sign as [Your name]. Return only the message."
        ),
        content=context,
        max_tokens=350,
    )
    return {"lead_id": lead.id, "channel": body.channel, "message": message}
