"""Tiny in-process rate limiter for the AI endpoints — a runaway-spend guard.

Per-minute sliding window. In-memory only (fine for a single dev/worker process);
Phase 8 replaces this with Redis-backed, per-tenant limits + plan quotas.
"""
import time
from collections import defaultdict, deque

from fastapi import HTTPException

from app.config import get_settings

_calls: dict[str, deque] = defaultdict(deque)


def enforce_ai_rate_limit(key: str = "global") -> None:
    limit = get_settings().ai_rate_limit_per_minute
    if limit <= 0:
        return
    now = time.monotonic()
    q = _calls[key]
    while q and now - q[0] > 60.0:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"AI rate limit reached ({limit}/min). Slow down to keep API costs down.",
        )
    q.append(now)


async def ai_rate_limiter() -> None:
    """FastAPI dependency."""
    enforce_ai_rate_limit()
