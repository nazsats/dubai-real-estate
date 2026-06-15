"""Real-time analytics for the agent dashboard — computed from live DB data.

This is the most reliable 'real-time' source (no external API needed): it
aggregates the agency's own leads/deals plus the property inventory.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db import get_session
from app.models import Deal, Lead, Property, User

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# Approx coordinates for popular Dubai areas (for the map markers).
AREA_COORDS: dict[str, list[float]] = {
    "Dubai Marina": [25.0805, 55.1403],
    "Downtown Dubai": [25.1972, 55.2744],
    "Palm Jumeirah": [25.1124, 55.1390],
    "Dubai Hills Estate": [25.1118, 55.2638],
    "Business Bay": [25.1852, 55.2755],
    "Jumeirah Village Circle": [25.0475, 55.1994],
    "Arabian Ranches": [25.0520, 55.2700],
    "Emirates Hills": [25.0745, 55.1668],
    "Jumeirah Beach Residence": [25.0785, 55.1340],
    "Dubai Creek Harbour": [25.2048, 55.3479],
    "Al Furjan": [25.0260, 55.1460],
    "Meydan": [25.1650, 55.3000],
    "Dubai South": [24.8960, 55.1610],
    "Dubai Silicon Oasis": [25.1213, 55.3773],
    "Al Barsha": [25.1130, 55.2000],
    "JLT": [25.0693, 55.1440],
}


@router.get("/dashboard")
async def dashboard(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    agency = user.agency_id
    prop_scope = or_(Property.agency_id == agency, Property.agency_id.is_(None))

    # ── Headline stats ────────────────────────────────────────
    total_leads = (
        await session.execute(select(func.count(Lead.id)).where(Lead.agency_id == agency))
    ).scalar_one()
    total_props = (await session.execute(select(func.count(Property.id)).where(prop_scope))).scalar_one()

    deals = list((await session.execute(select(Deal).where(Deal.agency_id == agency))).scalars().all())
    won = [d for d in deals if d.stage == "Won"]
    open_deals = [d for d in deals if d.stage == "Negotiation"]
    won_value = float(sum(float(d.value) for d in won))
    pipeline_value = float(sum(float(d.value) for d in open_deals))
    commission_won = float(sum(float(d.commission) for d in won))

    # ── Leads by pipeline stage ───────────────────────────────
    stage_rows = (
        await session.execute(
            select(Lead.status, func.count(Lead.id)).where(Lead.agency_id == agency).group_by(Lead.status)
        )
    ).all()
    leads_by_stage = [{"stage": s, "count": c} for s, c in stage_rows]

    # ── Leads by source ───────────────────────────────────────
    source_rows = (
        await session.execute(
            select(Lead.source, func.count(Lead.id)).where(Lead.agency_id == agency).group_by(Lead.source)
        )
    ).all()
    leads_by_source = [{"source": s or "unknown", "count": c} for s, c in source_rows]

    # ── Leads over the last 30 days ───────────────────────────
    since = datetime.now(timezone.utc) - timedelta(days=30)
    day = func.date(Lead.created_at)
    time_rows = (
        await session.execute(
            select(day.label("d"), func.count(Lead.id))
            .where(and_(Lead.agency_id == agency, Lead.created_at >= since))
            .group_by(day)
            .order_by(day)
        )
    ).all()
    leads_over_time = [{"date": str(d), "count": c} for d, c in time_rows]

    # ── Inventory by property type ────────────────────────────
    type_rows = (
        await session.execute(
            select(Property.type, func.count(Property.id)).where(prop_scope).group_by(Property.type)
        )
    ).all()
    properties_by_type = [{"type": t, "count": c} for t, c in type_rows]

    # ── Price & inventory by area (top 12 by count) ───────────
    area_rows = (
        await session.execute(
            select(
                Property.location,
                func.count(Property.id).label("count"),
                func.avg(Property.price).label("avg_price"),
                func.avg(Property.price / func.nullif(Property.size_sqft, 0)).label("avg_ppsf"),
            )
            .where(prop_scope)
            .group_by(Property.location)
            .order_by(func.count(Property.id).desc())
            .limit(12)
        )
    ).all()
    avg_price_by_area = [
        {
            "location": loc,
            "count": int(count),
            "avg_price": round(float(avg_price or 0)),
            "avg_ppsf": round(float(avg_ppsf or 0)),
        }
        for loc, count, avg_price, avg_ppsf in area_rows
    ]

    # ── Map markers (areas we have coordinates for) ───────────
    area_markers = [
        {**row, "lat": AREA_COORDS[row["location"]][0], "lng": AREA_COORDS[row["location"]][1]}
        for row in avg_price_by_area
        if row["location"] in AREA_COORDS
    ]

    return {
        "stats": {
            "leads": total_leads,
            "properties": total_props,
            "won_deals": len(won),
            "open_deals": len(open_deals),
            "won_value": won_value,
            "pipeline_value": pipeline_value,
            "commission_won": commission_won,
        },
        "leads_by_stage": leads_by_stage,
        "leads_by_source": leads_by_source,
        "leads_over_time": leads_over_time,
        "properties_by_type": properties_by_type,
        "avg_price_by_area": avg_price_by_area,
        "area_markers": area_markers,
    }
