"""Async SQLAlchemy engine, session factory, and base model."""
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

_is_postgres = "asyncpg" in settings.async_database_url

# asyncpg through a pgbouncer pooler (e.g. Supabase) can't reuse prepared
# statements — disabling the statement cache makes it work on any pooler mode.
_connect_args: dict = {"statement_cache_size": 0} if _is_postgres else {}

# SQLite has no server-side connection limit, so pool sizing only applies to
# Postgres. Supabase's free tier caps pooler connections fairly low, and every
# web worker keeps its own pool — so `db_pool_size + db_max_overflow` is the
# ceiling *per worker*. Keep it modest or you'll hit "too many connections"
# under load rather than under traffic you actually care about.
_pool_args: dict = {}
if _is_postgres:
    _pool_args = {
        "pool_size": settings.db_pool_size,
        "max_overflow": settings.db_max_overflow,
        # Recycle before a pooler or cloud provider silently drops idle
        # connections, which otherwise surfaces as a random query failure.
        "pool_recycle": 1800,
        "pool_timeout": 30,
    }

engine = create_async_engine(
    settings.async_database_url,
    echo=settings.debug,
    pool_pre_ping=True,
    connect_args=_connect_args,
    **_pool_args,
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a request-scoped DB session."""
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    """Create tables if they don't exist. (Phase 1 will switch to Alembic migrations.)"""
    from app import models  # noqa: F401 — ensure models are registered

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
