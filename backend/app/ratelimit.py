"""Per-tenant rate limiter for the AI endpoints — a runaway-spend guard.

Per-minute sliding window, keyed by agency so one busy tenant can't exhaust the
quota for everyone else. In-memory, so the effective limit is per worker process;
Phase 8 replaces this with Redis-backed limits + per-plan quotas.
"""
import time
from collections import defaultdict, deque

from fastapi import Depends, HTTPException

from app.api.deps import get_current_user
from app.config import get_settings
from app.models import User

_calls: dict[str, deque] = defaultdict(deque)
# Stop the key map growing without bound on a long-lived process.
_MAX_TRACKED_KEYS = 10_000


def enforce_ai_rate_limit(key: str = "global") -> None:
    limit = get_settings().ai_rate_limit_per_minute
    if limit <= 0:
        return

    now = time.monotonic()
    q = _calls[key]
    while q and now - q[0] > 60.0:
        q.popleft()

    if len(q) >= limit:
        retry_after = max(1, int(60 - (now - q[0])) + 1)
        raise HTTPException(
            status_code=429,
            detail=(
                f"AI rate limit reached ({limit} requests/minute). "
                f"Try again in about {retry_after}s."
            ),
            headers={"Retry-After": str(retry_after)},
        )
    q.append(now)

    # Opportunistic cleanup of windows that have fully expired.
    if len(_calls) > _MAX_TRACKED_KEYS:
        for stale in [k for k, v in _calls.items() if not v or now - v[-1] > 120.0]:
            del _calls[stale]


async def ai_rate_limiter(user: User = Depends(get_current_user)) -> None:
    """FastAPI dependency — limits AI spend per agency."""
    enforce_ai_rate_limit(f"agency:{user.agency_id}")
