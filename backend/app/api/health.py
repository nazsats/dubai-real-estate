"""Health checks for the platform's uptime probes."""
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Property

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    """Liveness: is the process up? Deliberately does no I/O so a slow or briefly
    unavailable database can't cause the host to kill and restart a healthy app."""
    return {"status": "healthy"}


@router.get("/health/ready")
async def readiness(session: AsyncSession = Depends(get_session)):
    """Readiness: can we actually serve traffic (i.e. is the database reachable)?"""
    try:
        count = (await session.execute(select(func.count(Property.id)))).scalar_one()
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "database": "unreachable", "detail": str(exc)[:200]},
        )
    return {"status": "ready", "database": "connected", "properties": count}
