"""Market analysis over official DLD transaction history.

WHY THIS IS SQL AND NOT RAG
---------------------------
DLD transactions are structured rows: date, area, type, rooms, size, price. The
questions agents ask about them are aggregate questions — "what's the average
price per sqft", "how many 2-beds sold last quarter", "is Marina up or down".

Retrieval-augmented generation answers by embedding the question, pulling the
top-k most similar chunks, and letting the model read them. That is the wrong
shape for this data, and not by a small margin:

  * It cannot aggregate. Ask for an average over 5,000 transactions and RAG
    retrieves maybe 20, then the model averages those 20 and states it as the
    market average. The number is wrong, and it is wrong *confidently* — there
    is no signal in the output that 4,980 rows were never looked at.
  * Numeric filters degrade into vibes. "Under 3M" is an exact predicate;
    embedding similarity has no notion of less-than.
  * Counting is impossible. "How many sold" has no meaning in a top-k retrieval.
  * It costs more and is slower — embedding the query, a vector scan, then
    thousands of retrieved tokens into the prompt, to produce a worse answer
    than `SELECT avg(...) GROUP BY ...` returns in milliseconds.

So the market tool below is deterministic SQL. Claude chooses the *filters*;
Postgres computes the *numbers*. The model never sees raw rows it has to
average in its head, which is exactly the operation language models are least
reliable at.

RAG earns its place elsewhere in this app — over the broker knowledge base,
where answers live in prose and the fields cannot be enumerated in advance.
See `app/ai/knowledge.py` for that side of the split.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DldTransaction

SQFT_PER_SQM = 10.7639


def _fmt_aed(value: float) -> str:
    if value >= 1_000_000:
        return f"AED {value / 1_000_000:.2f}M"
    if value >= 1_000:
        return f"AED {value / 1_000:.0f}K"
    return f"AED {value:,.0f}"


def _median(values: list[float]) -> float | None:
    """Median matters more than mean here — a single AED 200M penthouse in a
    sample of mid-market flats drags the average somewhere no real buyer is."""
    if not values:
        return None
    s = sorted(values)
    mid = len(s) // 2
    return s[mid] if len(s) % 2 else (s[mid - 1] + s[mid]) / 2


async def market_stats(
    session: AsyncSession,
    *,
    area: str | None = None,
    property_type: str | None = None,
    rooms: int | None = None,
    months: int = 12,
    registration_type: str | None = None,
) -> dict:
    """Aggregate real DLD sales for a slice of the market.

    Returns headline stats plus a month-by-month series, so trend direction is
    computed from the data rather than inferred by the model.
    """
    since = datetime.now(timezone.utc) - timedelta(days=months * 30)

    conds = [
        DldTransaction.transaction_date >= since,
        DldTransaction.transaction_type == "Sales",
    ]
    if area:
        conds.append(DldTransaction.area.ilike(f"%{area}%"))
    if property_type:
        conds.append(DldTransaction.property_type.ilike(f"%{property_type}%"))
    if rooms is not None:
        conds.append(DldTransaction.rooms == rooms)
    if registration_type:
        conds.append(DldTransaction.registration_type.ilike(f"%{registration_type}%"))

    rows = (
        await session.execute(
            select(
                DldTransaction.transaction_date,
                DldTransaction.price_aed,
                DldTransaction.price_per_sqft,
                DldTransaction.size_sqft,
                DldTransaction.area,
            ).where(and_(*conds))
        )
    ).all()

    if not rows:
        return {"count": 0, "filters": {"area": area, "type": property_type, "rooms": rooms, "months": months}}

    prices = [float(r.price_aed) for r in rows]
    ppsf = [float(r.price_per_sqft) for r in rows if r.price_per_sqft]
    sizes = [int(r.size_sqft) for r in rows if r.size_sqft]

    # Month-by-month median ppsf → trend computed, not guessed.
    by_month: dict[str, list[float]] = {}
    for r in rows:
        if r.price_per_sqft:
            by_month.setdefault(r.transaction_date.strftime("%Y-%m"), []).append(float(r.price_per_sqft))
    series = [
        {"month": m, "median_ppsf": round(_median(v) or 0), "sales": len(v)}
        for m, v in sorted(by_month.items())
    ]

    # Direction: compare the first and last third of the window, not adjacent
    # months — month-to-month noise on thin samples is not a trend.
    trend_pct = None
    if len(series) >= 3:
        third = max(1, len(series) // 3)
        early = _median([s["median_ppsf"] for s in series[:third]])
        late = _median([s["median_ppsf"] for s in series[-third:]])
        if early:
            trend_pct = round((late - early) / early * 100, 1)

    return {
        "count": len(rows),
        "filters": {
            "area": area, "type": property_type, "rooms": rooms,
            "months": months, "registration_type": registration_type,
        },
        "median_price": round(_median(prices) or 0),
        "avg_price": round(sum(prices) / len(prices)),
        "min_price": round(min(prices)),
        "max_price": round(max(prices)),
        "median_ppsf": round(_median(ppsf) or 0) if ppsf else None,
        "median_size_sqft": round(_median([float(s) for s in sizes]) or 0) if sizes else None,
        "trend_pct": trend_pct,
        "monthly": series[-12:],
    }


async def comparables(
    session: AsyncSession,
    *,
    area: str,
    property_type: str | None = None,
    rooms: int | None = None,
    size_sqft: int | None = None,
    months: int = 6,
    limit: int = 8,
) -> list[dict]:
    """The most similar recent sales — what an agent shows to justify a price.

    Similarity here is explicit and defensible (same area, same bed count,
    closest size), not an opaque embedding distance. When a buyer asks "why
    that price?", "these eight flats in your building sold for this" is an
    answer; "the vector search said so" is not.
    """
    since = datetime.now(timezone.utc) - timedelta(days=months * 30)
    conds = [
        DldTransaction.transaction_date >= since,
        DldTransaction.transaction_type == "Sales",
        DldTransaction.area.ilike(f"%{area}%"),
    ]
    if property_type:
        conds.append(DldTransaction.property_type.ilike(f"%{property_type}%"))
    if rooms is not None:
        conds.append(DldTransaction.rooms == rooms)

    rows = (
        await session.execute(
            select(DldTransaction)
            .where(and_(*conds))
            .order_by(DldTransaction.transaction_date.desc())
            .limit(200)
        )
    ).scalars().all()

    # Rank by size proximity when a size is given; otherwise most recent wins.
    if size_sqft:
        rows = sorted(rows, key=lambda t: abs((t.size_sqft or 0) - size_sqft))

    return [
        {
            "date": t.transaction_date.strftime("%Y-%m-%d"),
            "area": t.area,
            "building": t.building,
            "type": t.property_type,
            "rooms": t.rooms,
            "size_sqft": t.size_sqft,
            "price": float(t.price_aed),
            "ppsf": float(t.price_per_sqft) if t.price_per_sqft else None,
            "status": t.registration_type,
        }
        for t in rows[:limit]
    ]


def format_stats(stats: dict) -> str:
    """Render stats as compact text for the model.

    Deliberately pre-computed and terse: the model's job is to interpret and
    advise, not to do arithmetic on a table of raw rows.
    """
    f = stats["filters"]
    scope = " ".join(
        p for p in [
            f"{f['rooms']}BR" if f.get("rooms") is not None else "",
            f.get("type") or "",
            f"in {f['area']}" if f.get("area") else "across Dubai",
            f"({f.get('registration_type')})" if f.get("registration_type") else "",
        ] if p
    )
    if not stats["count"]:
        return (
            f"No DLD sales recorded for {scope} in the last {f['months']} months. "
            "Either the filters are too narrow or that slice has no transaction history loaded."
        )

    lines = [
        f"DLD sales — {scope}, last {f['months']} months ({stats['count']} transactions):",
        f"  Median price   {_fmt_aed(stats['median_price'])}   (avg {_fmt_aed(stats['avg_price'])})",
        f"  Range          {_fmt_aed(stats['min_price'])} – {_fmt_aed(stats['max_price'])}",
    ]
    if stats.get("median_ppsf"):
        lines.append(f"  Median AED/sqft {stats['median_ppsf']:,}")
    if stats.get("median_size_sqft"):
        lines.append(f"  Median size    {stats['median_size_sqft']:,} sqft")
    if stats.get("trend_pct") is not None:
        d = "up" if stats["trend_pct"] > 0 else "down" if stats["trend_pct"] < 0 else "flat"
        lines.append(f"  Trend          {d} {abs(stats['trend_pct'])}% on price/sqft over the window")
    if stats.get("monthly"):
        recent = stats["monthly"][-6:]
        lines.append("  Recent months  " + ", ".join(f"{m['month']}: {m['median_ppsf']:,}/sqft ({m['sales']} sales)" for m in recent))
    return "\n".join(lines)


def format_comparables(rows: list[dict]) -> str:
    if not rows:
        return "No comparable DLD sales found for that profile."
    out = ["Comparable recent DLD sales:"]
    for r in rows:
        bits = [
            r["date"],
            f"{r['rooms']}BR" if r.get("rooms") is not None else "",
            r.get("type") or "",
            f"in {r['building']}" if r.get("building") else "",
            r["area"],
            f"{r['size_sqft']:,} sqft" if r.get("size_sqft") else "",
            _fmt_aed(r["price"]),
            f"({r['ppsf']:,.0f}/sqft)" if r.get("ppsf") else "",
            f"[{r['status']}]" if r.get("status") else "",
        ]
        out.append("  " + " · ".join(b for b in bits if b))
    return "\n".join(out)
