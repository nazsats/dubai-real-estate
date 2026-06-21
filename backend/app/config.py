"""Application configuration, loaded from environment / .env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Core
    database_url: str  # e.g. postgresql://user:pass@localhost:5432/dubai_broker
    anthropic_api_key: str
    debug: bool = False

    # Auth — CHANGE secret_key in production (any long random string).
    secret_key: str = "dev-secret-change-me-please-0123456789"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    jwt_algorithm: str = "HS256"

    # Create tables on startup (dev convenience). Set false once you adopt Alembic.
    auto_create_tables: bool = True

    # RapidAPI Byut API (real Dubai listings) — get a free key at rapidapi.com.
    rapidapi_key: str = ""
    rapidapi_bayut_host: str = "byut-api.p.rapidapi.com"

    # AI models — see the claude-api skill.
    # Default to Haiku (cheapest) to control cost; smart model is opt-in per call.
    claude_model: str = "claude-haiku-4-5"
    claude_smart_model: str = "claude-sonnet-4-6"

    # Cost controls
    use_thinking: bool = False  # extended thinking burns extra tokens
    ai_max_tokens: int = 1500   # output cap per AI call
    ai_rate_limit_per_minute: int = 15  # runaway-spend guard (0 = unlimited)

    # CORS — the Next.js frontend origin(s)
    cors_origins: str = "http://localhost:3000"

    # Seed ~N demo properties on first run so the app is usable immediately.
    seed_property_count: int = 2000

    @property
    def async_database_url(self) -> str:
        """Normalize to the async driver SQLAlchemy expects (asyncpg / aiosqlite)."""
        url = self.database_url
        if url.startswith("postgresql+asyncpg://"):
            return url
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        if url.startswith("sqlite+aiosqlite://"):
            return url
        if url.startswith("sqlite://"):
            return url.replace("sqlite://", "sqlite+aiosqlite://", 1)
        return url

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
