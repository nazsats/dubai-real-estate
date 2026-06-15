"""Authentication: agency signup, login, invite, current user."""
import re
import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.db import get_session
from app.models import Agency, User
from app.schemas import InviteRequest, LoginRequest, SignupRequest, TokenResponse, UserOut
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _slugify(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "agency"
    return base[:100]


async def _email_taken(session: AsyncSession, email: str) -> bool:
    existing = await session.execute(select(User).where(User.email == email.lower()))
    return existing.scalar_one_or_none() is not None


@router.post("/signup", response_model=TokenResponse, status_code=201)
async def signup(body: SignupRequest, session: AsyncSession = Depends(get_session)):
    """Create a new agency + its first admin user."""
    if await _email_taken(session, body.email):
        raise HTTPException(409, "Email already registered")

    # Ensure a unique slug.
    slug = _slugify(body.agency_name)
    if (await session.execute(select(Agency).where(Agency.slug == slug))).scalar_one_or_none():
        slug = f"{slug}-{int(time.time())}"

    agency = Agency(name=body.agency_name, slug=slug)
    session.add(agency)
    await session.flush()  # get agency.id

    user = User(
        agency_id=agency.id,
        email=body.email.lower(),
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role="admin",
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, session: AsyncSession = Depends(get_session)):
    user = (await session.execute(select(User).where(User.email == body.email.lower()))).scalar_one_or_none()
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(401, "Invalid email or password")
    if not user.is_active:
        raise HTTPException(403, "Account is disabled")
    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user


@router.post("/invite", response_model=UserOut, status_code=201)
async def invite(
    body: InviteRequest,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Admin adds an agent (or another admin) to their own agency."""
    if body.role not in ("admin", "agent"):
        raise HTTPException(400, "role must be 'admin' or 'agent'")
    if await _email_taken(session, body.email):
        raise HTTPException(409, "Email already registered")
    user = User(
        agency_id=admin.agency_id,
        email=body.email.lower(),
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role=body.role,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@router.get("/users", response_model=list[UserOut])
async def list_users(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    """List users in the caller's agency (for owner/assignee pickers)."""
    rows = await session.execute(select(User).where(User.agency_id == user.agency_id).order_by(User.full_name))
    return list(rows.scalars().all())
