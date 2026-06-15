"""Health check."""
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Property

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(session: AsyncSession = Depends(get_session)):
    count = (await session.execute(select(func.count(Property.id)))).scalar_one()
    return {"status": "healthy", "properties": count}
