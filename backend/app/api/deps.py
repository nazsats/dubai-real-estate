"""Shared FastAPI dependencies: authentication + tenant context."""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import User
from app.security import decode_token

bearer = HTTPBearer(auto_error=True)


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    session: AsyncSession = Depends(get_session),
) -> User:
    user_id = decode_token(creds.credentials)
    if user_id is None:
        raise HTTPException(401, "Invalid or expired token")
    user = await session.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(401, "User not found or inactive")
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(403, "Admin role required")
    return user
