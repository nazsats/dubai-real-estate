"""Broker-submitted listings and the admin verification queue.

Agents submit their own stock; an admin reviews it before it becomes visible to
anyone else. Until approved, a listing is visible only to its author and to
admins — the moderation gate itself lives in `fetch_properties`, so no endpoint
or AI tool can surface pending stock by forgetting a filter.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.market import comparables, market_stats
from app.api.deps import get_current_user, require_admin
from app.db import get_session
from app.models import Agency, Property, User
from app.schemas import ListingSubmission, PropertyDetail, ReviewRequest

router = APIRouter(prefix="/api/listings", tags=["listings"])


async def _detail(prop: Property, session: AsyncSession) -> PropertyDetail:
    """Serialise a property with its agent contact and agency name.

    Every field but `agency_name` maps straight off the ORM object, so the
    schema is validated from attributes rather than field-by-field — listing
    them by hand meant a new column silently failed to reach the page.

    Callers must have loaded `listed_by` (selectinload or refresh); a lazy load
    here would raise under asyncio rather than emit a query.
    """
    agency_name = None
    if prop.agency_id:
        agency = await session.get(Agency, prop.agency_id)
        agency_name = agency.name if agency else None
    return PropertyDetail.model_validate(prop).model_copy(update={"agency_name": agency_name})


@router.get("/mine", response_model=list[PropertyDetail])
async def my_listings(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """The caller's own submissions, in every state.

    Rejected entries are included on purpose, with their reason, so the broker
    can correct and resubmit instead of guessing what was wrong.
    """
    rows = (
        await session.execute(
            select(Property)
            .options(selectinload(Property.listed_by))
            .where(Property.listed_by_id == user.id)
            .order_by(Property.created_at.desc())
            .limit(200)
        )
    ).scalars().all()
    return [await _detail(p, session) for p in rows]


@router.post("", response_model=PropertyDetail, status_code=201)
async def submit_listing(
    body: ListingSubmission,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Submit a listing for review.

    Always lands as `pending`, including for admins — an admin who wants stock
    live immediately uses the CSV/Bayut import path, which is explicitly an
    ingestion tool. Keeping one rule here means "submitted" always means
    "reviewed by a second pair of eyes".
    """
    prop = Property(
        agency_id=user.agency_id,
        listed_by_id=user.id,
        source="broker",
        status="pending",
        submitted_at=datetime.now(timezone.utc),
        available=True,
        **body.model_dump(),
    )
    session.add(prop)
    await session.commit()
    await session.refresh(prop, ["listed_by"])
    return await _detail(prop, session)


@router.patch("/{listing_id}", response_model=PropertyDetail)
async def update_listing(
    listing_id: int,
    body: ListingSubmission,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Edit a submission and send it back for review.

    Editing an already-approved listing returns it to `pending`: an approval
    applies to the content that was reviewed, not to the row forever. Without
    this, a broker could get a modest listing approved and then edit the price
    and description into something nobody vetted.
    """
    prop = await session.get(Property, listing_id)
    if prop is None or prop.listed_by_id != user.id:
        raise HTTPException(404, "Listing not found")

    for field, value in body.model_dump().items():
        setattr(prop, field, value)
    prop.status = "pending"
    prop.rejection_reason = None
    prop.reviewed_by_id = None
    prop.reviewed_at = None
    prop.submitted_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(prop, ["listed_by"])
    return await _detail(prop, session)


@router.delete("/{listing_id}", status_code=204)
async def withdraw_listing(
    listing_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    prop = await session.get(Property, listing_id)
    if prop is None or prop.listed_by_id != user.id:
        raise HTTPException(404, "Listing not found")
    await session.delete(prop)
    await session.commit()


# ── Admin moderation ────────────────────────────────────────────────


@router.get("/review/queue", response_model=list[PropertyDetail])
async def review_queue(
    status: str = Query("pending", pattern="^(pending|approved|rejected)$"),
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Submissions awaiting review, oldest first.

    Oldest-first is deliberate: newest-first starves the back of the queue, and
    a broker whose listing sits unreviewed for a week stops submitting.
    """
    rows = (
        await session.execute(
            select(Property)
            .options(selectinload(Property.listed_by))
            .where(
                Property.status == status,
                Property.source == "broker",
                Property.agency_id == admin.agency_id,
            )
            .order_by(Property.submitted_at.asc().nulls_last())
            .limit(200)
        )
    ).scalars().all()
    return [await _detail(p, session) for p in rows]


@router.get("/review/counts")
async def review_counts(
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Per-status counts — drives the badge on the nav item."""
    rows = (
        await session.execute(
            select(Property.status, func.count(Property.id))
            .where(Property.source == "broker", Property.agency_id == admin.agency_id)
            .group_by(Property.status)
        )
    ).all()
    counts = {s: int(n) for s, n in rows}
    return {s: counts.get(s, 0) for s in ("pending", "approved", "rejected")}


@router.post("/{listing_id}/review", response_model=PropertyDetail)
async def review_listing(
    listing_id: int,
    body: ReviewRequest,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Approve or reject a submission."""
    prop = await session.get(Property, listing_id)
    if prop is None or prop.agency_id != admin.agency_id:
        raise HTTPException(404, "Listing not found")

    if not body.approve and not (body.reason or "").strip():
        raise HTTPException(400, "A rejection needs a reason the broker can act on.")

    prop.status = "approved" if body.approve else "rejected"
    prop.rejection_reason = None if body.approve else body.reason.strip()
    prop.reviewed_by_id = admin.id
    prop.reviewed_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(prop, ["listed_by"])
    return await _detail(prop, session)


# ── Market context for the property page ────────────────────────────


@router.get("/{listing_id}/market")
async def listing_market(
    listing_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Price context for one listing: recorded DLD sales plus live comparables.

    Two sources, kept separate and labelled, because they answer different
    questions. DLD is what actually transacted — the defensible number to put
    in front of a buyer. `asking` is what other agents are currently asking,
    which is sentiment, not evidence. Blending them into one "market average"
    would quietly mix a fact with an aspiration.

    Both may be empty (no DLD import, thin area). The response says so
    explicitly rather than returning a zero that reads like a real figure.
    """
    prop = await session.get(Property, listing_id)
    visible = prop is not None and (prop.agency_id is None or prop.agency_id == user.agency_id)
    if not visible:
        raise HTTPException(404, "Property not found")

    stats = await market_stats(
        session, area=prop.location, property_type=prop.type, rooms=prop.bedrooms, months=12
    )
    comps = await comparables(
        session,
        area=prop.location,
        property_type=prop.type,
        rooms=prop.bedrooms,
        size_sqft=prop.size_sqft,
        months=12,
        limit=6,
    )

    # Live asking prices for the same shape of unit, from approved stock only.
    asking_rows = (
        await session.execute(
            select(Property.price, Property.size_sqft)
            .where(
                Property.id != prop.id,
                Property.status == "approved",
                Property.location == prop.location,
                Property.type == prop.type,
                Property.bedrooms == prop.bedrooms,
                Property.size_sqft > 0,
                or_(Property.agency_id.is_(None), Property.agency_id == user.agency_id),
            )
            .limit(400)
        )
    ).all()
    asking_ppsf = sorted(float(p) / s for p, s in asking_rows)
    asking_median = (
        asking_ppsf[len(asking_ppsf) // 2] if asking_ppsf else None
    )

    this_ppsf = round(prop.price / prop.size_sqft) if prop.size_sqft else None

    # Position this listing against whichever benchmark we actually have,
    # preferring recorded sales over asking prices.
    benchmark = stats.get("median_ppsf") or asking_median
    benchmark_source = "dld" if stats.get("median_ppsf") else ("asking" if asking_median else None)
    delta_pct = (
        round((this_ppsf - benchmark) / benchmark * 100, 1)
        if this_ppsf and benchmark
        else None
    )

    return {
        "this_ppsf": this_ppsf,
        "benchmark_ppsf": round(benchmark) if benchmark else None,
        "benchmark_source": benchmark_source,
        "delta_pct": delta_pct,
        "dld": stats if stats.get("count") else None,
        "asking": {
            "count": len(asking_ppsf),
            "median_ppsf": round(asking_median) if asking_median else None,
        },
        "comparables": comps,
    }


# ── Public-ish detail (any authenticated user in the agency) ─────────


@router.get("/{listing_id}", response_model=PropertyDetail)
async def get_listing(
    listing_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Full detail for the property page, including agent contact.

    Unapproved listings are readable only by their author or an admin — the
    same 404 is returned either way so the endpoint can't be used to probe for
    listing ids.
    """
    prop = (
        await session.execute(
            select(Property).options(selectinload(Property.listed_by)).where(Property.id == listing_id)
        )
    ).scalar_one_or_none()

    visible_scope = prop is not None and (prop.agency_id is None or prop.agency_id == user.agency_id)
    if not visible_scope:
        raise HTTPException(404, "Property not found")

    if prop.status != "approved":
        is_author = prop.listed_by_id == user.id
        if not (is_author or user.role == "admin"):
            raise HTTPException(404, "Property not found")

    return await _detail(prop, session)
