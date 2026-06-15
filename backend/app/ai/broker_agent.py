"""The broker brain: NL property search, lead→property matching, pitching, marketing.

Phase 2 of the build. Each function takes a tenant-scoped DB session and an
`agency_id` so results stay within a tenant's inventory + the shared pool.
"""
import json

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.client import generate, run_tool_loop, text_of
from app.models import Lead, Property

DUBAI_AREAS = (
    "Dubai Marina, Downtown Dubai, Palm Jumeirah, Dubai Hills Estate, Business Bay, "
    "Jumeirah Village Circle (JVC), Arabian Ranches, Emirates Hills, JBR, "
    "Dubai Creek Harbour, Al Furjan, Meydan, Dubai South, JLT"
)


def fmt_aed(value: float) -> str:
    return f"AED {int(value):,}"


def describe(p: Property) -> str:
    amenities = [n for n, on in (("Pool", p.has_pool), ("Gym", p.has_gym), ("Balcony", p.has_balcony)) if on]
    amen = f" [{', '.join(amenities)}]" if amenities else ""
    ppsf = f" (~AED {int(float(p.price) / p.size_sqft):,}/sqft)" if p.size_sqft else ""
    return (
        f"#{p.id} · {p.bedrooms}BR {p.type} in {p.building}, {p.location} — "
        f"{int(p.size_sqft):,} sqft — {fmt_aed(float(p.price))}{ppsf}{amen} · {p.possession}"
    )


async def fetch_properties(
    session: AsyncSession,
    agency_id: int | None,
    *,
    location: str | None = None,
    property_type: str | None = None,
    min_bedrooms: int | None = None,
    max_bedrooms: int | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    require_pool: bool | None = None,
    require_gym: bool | None = None,
    only_available: bool = True,
    sort: str = "relevance",
    limit: int = 12,
) -> list[Property]:
    """Tenant-scoped property query: this agency's listings + the shared pool."""
    stmt = select(Property)
    # Tenant isolation: shared pool (NULL agency) plus this tenant's own listings.
    if agency_id is not None:
        stmt = stmt.where(or_(Property.agency_id == agency_id, Property.agency_id.is_(None)))

    conds = []
    if only_available:
        conds.append(Property.available.is_(True))
    if location:
        conds.append(Property.location.ilike(f"%{location}%"))
    if property_type:
        conds.append(Property.type.ilike(f"%{property_type}%"))
    if min_bedrooms is not None:
        conds.append(Property.bedrooms >= min_bedrooms)
    if max_bedrooms is not None:
        conds.append(Property.bedrooms <= max_bedrooms)
    if min_price is not None:
        conds.append(Property.price >= min_price)
    if max_price is not None:
        conds.append(Property.price <= max_price)
    if require_pool:
        conds.append(Property.has_pool.is_(True))
    if require_gym:
        conds.append(Property.has_gym.is_(True))
    if conds:
        stmt = stmt.where(and_(*conds))

    if sort == "price_asc":
        stmt = stmt.order_by(Property.price.asc())
    elif sort == "price_desc":
        stmt = stmt.order_by(Property.price.desc())
    else:
        stmt = stmt.order_by(Property.price.asc())

    stmt = stmt.limit(min(limit, 50))
    result = await session.execute(stmt)
    return list(result.scalars().all())


# ── 1. Natural-language search (agentic, with a DB tool) ──────────────
SEARCH_TOOL = {
    "name": "search_properties",
    "description": (
        "Search the Dubai property inventory with structured filters. Call this for ANY "
        "request to find, list, filter, compare, or count properties. Returns matching listings."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "location": {"type": "string", "description": f"Dubai area, e.g. one of: {DUBAI_AREAS}"},
            "property_type": {"type": "string", "enum": ["Apartment", "Villa", "Townhouse", "Penthouse"]},
            "min_bedrooms": {"type": "integer"},
            "max_bedrooms": {"type": "integer"},
            "min_price": {"type": "number", "description": "Minimum price in AED"},
            "max_price": {"type": "number", "description": "Maximum price in AED"},
            "require_pool": {"type": "boolean"},
            "require_gym": {"type": "boolean"},
            "sort": {"type": "string", "enum": ["relevance", "price_asc", "price_desc"]},
            "limit": {"type": "integer", "description": "Max results (<=50)"},
        },
    },
}

SEARCH_SYSTEM = (
    "You are an expert Dubai real-estate assistant for agents. Only handle Dubai real estate; "
    "if asked anything else, say so briefly. Use the search_properties tool to answer any "
    "property request, then present results clearly: building, area, bedrooms, size, price, key "
    "amenities. Lead with the best matches and add one short line of agent-useful insight "
    "(value, view, or trade-off). Be concise."
)


async def nl_search(session: AsyncSession, agency_id: int | None, query: str, history: list[dict]):
    """Run the conversational finder. Returns (answer_text, [Property]) for the last search."""
    last_results: list[Property] = []

    async def _exec_search(args: dict) -> str:
        nonlocal last_results
        props = await fetch_properties(session, agency_id, **args)
        last_results = props
        if not props:
            return "No matching properties. Suggest widening budget, area, or filters."
        return "\n".join(describe(p) for p in props)

    messages = [*history, {"role": "user", "content": query}]
    response = await run_tool_loop(
        system=SEARCH_SYSTEM,
        messages=messages,
        tools=[SEARCH_TOOL],
        executors={"search_properties": _exec_search},
    )
    return text_of(response), last_results


# ── 2. Lead → property matching ───────────────────────────────────────
async def _candidates_for_lead(session: AsyncSession, lead: Lead, pool: int = 15) -> list[Property]:
    locations = [s.strip() for s in (lead.preferred_locations or "").split(",") if s.strip()]
    # Pull a generous candidate set with soft budget headroom; Claude ranks the final shortlist.
    props = await fetch_properties(
        session,
        lead.agency_id,
        property_type=lead.property_type,
        min_bedrooms=lead.bedrooms,
        max_price=float(lead.budget_max) * 1.1 if lead.budget_max else None,
        min_price=float(lead.budget_min) * 0.9 if lead.budget_min else None,
        limit=pool,
    )
    if locations:
        preferred = [p for p in props if any(loc.lower() in p.location.lower() for loc in locations)]
        props = preferred or props
    return props


def _lead_brief(lead: Lead) -> str:
    budget = "any"
    if lead.budget_min or lead.budget_max:
        budget = f"{fmt_aed(float(lead.budget_min or 0))} – {fmt_aed(float(lead.budget_max or 0))}"
    return (
        f"Lead: {lead.name} (lang: {lead.language})\n"
        f"Budget: {budget}\nBedrooms: {lead.bedrooms or 'any'}\n"
        f"Type: {lead.property_type or 'any'}\n"
        f"Preferred areas: {lead.preferred_locations or 'open'}\n"
        f"Notes: {lead.notes or '—'}"
    )


async def match_lead(session: AsyncSession, lead: Lead, limit: int = 6):
    """Rank the best properties for a lead with rationale. Returns (text, [Property])."""
    candidates = await _candidates_for_lead(session, lead)
    if not candidates:
        return "No inventory matches this lead's brief yet. Broaden budget/area or add stock.", []

    catalog = "\n".join(describe(p) for p in candidates)
    text = await generate(
        system=(
            "You are a top Dubai buyer's agent. Given a lead's brief and candidate listings, pick the "
            f"best {limit} for THIS lead. Rank them, and for each give one sharp sentence on why it fits "
            "(budget, area, size, lifestyle). End with one smart next-step suggestion for the agent. Be concise."
        ),
        content=f"{_lead_brief(lead)}\n\nCANDIDATES:\n{catalog}",
    )
    return text, candidates[:limit]


# ── 3. Pitch (channel-ready outreach) ─────────────────────────────────
async def write_pitch(session: AsyncSession, lead: Lead, channel: str, limit: int = 4):
    """Draft a ready-to-send WhatsApp/email pitch with a tailored shortlist."""
    candidates = await _candidates_for_lead(session, lead)
    shortlist = candidates[:limit]
    if not shortlist:
        return "No suitable properties to pitch yet.", []

    listings = "\n".join(describe(p) for p in shortlist)
    style = (
        "a WhatsApp message: warm, concise, mobile-friendly, light emoji, short lines, a clear CTA to book a viewing"
        if channel == "whatsapp"
        else "a professional but friendly email: subject line, greeting, 3-4 listings, clear CTA, sign-off"
    )
    text = await generate(
        system=(
            f"You are a Dubai real-estate agent writing outreach to a client. Write {style}. "
            f"Write in the client's language ({lead.language}). Personalize to their brief, highlight why each "
            "property fits, and make it ready to send as-is (no placeholders except the agent's name as [Your name])."
        ),
        content=f"{_lead_brief(lead)}\n\nSHORTLIST:\n{listings}",
    )
    return text, shortlist


# ── 4. Marketing pack (the priority feature) ──────────────────────────
async def marketing_pack(session: AsyncSession, prop: Property, channels: list[str]) -> dict:
    """Generate multi-channel marketing assets for a property. Returns {channel: copy}."""
    channel_specs = {
        "listing": "A portal listing (Bayut/Property Finder): catchy title + 120-180 word description with key selling points and a CTA.",
        "instagram": "An Instagram caption: punchy hook, 3-5 short lines, tasteful emoji, 8-12 relevant hashtags.",
        "ad": "A paid ad (Google/Meta): 3 headline variants (<=40 chars) + 2 primary-text variants (<=125 chars).",
        "story": "A 3-slide Instagram/WhatsApp story script: slide text + visual suggestion per slide.",
        "email_blast": "A short email blast to the agency's buyer list: subject + 80-120 word body + CTA.",
    }
    wanted = {c: channel_specs[c] for c in channels if c in channel_specs} or {"listing": channel_specs["listing"]}

    instructions = "\n".join(f"- `{c}`: {spec}" for c, spec in wanted.items())
    # Marketing copy can run a bit longer than the global cap — give it headroom.
    raw = await generate(
        system=(
            "You are a Dubai real-estate marketing expert. Produce polished, ready-to-publish, on-brand "
            "marketing copy that highlights real selling points and respects Dubai market norms. "
            "Return ONLY valid JSON: an object whose keys are the requested channel names and whose values "
            "are the copy strings (use \\n for line breaks). No commentary outside the JSON."
        ),
        content=f"PROPERTY:\n{describe(prop)}\n\nProduce these channels:\n{instructions}",
        max_tokens=2500,
    )
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Fall back to returning the raw text under a single key so the caller still gets value.
        return {"raw": raw}
