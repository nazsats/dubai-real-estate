"""Application configuration, loaded from environment / .env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_SECRET = "dev-secret-change-me-please-0123456789"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Core
    database_url: str  # e.g. postgresql://user:pass@localhost:5432/dubai_broker
    anthropic_api_key: str
    debug: bool = False

    # Deployment environment. Set ENVIRONMENT=production on your host to turn on
    # the safety checks below (real secret key, no dev seeding, docs hidden).
    environment: str = "development"

    # Auth — CHANGE secret_key in production (any long random string).
    secret_key: str = DEV_SECRET
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    jwt_algorithm: str = "HS256"

    # Create tables on startup (dev convenience). Set false once you adopt Alembic.
    auto_create_tables: bool = True

    # Postgres connection pool, per worker process. Sized for Supabase's free
    # tier — raise these together with your database plan, not ahead of it.
    db_pool_size: int = 5
    db_max_overflow: int = 5

    # Expose /docs and /redoc. Off in production by default (they reveal the whole API).
    enable_docs: bool = True

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

    # CORS — comma-separated Next.js frontend origin(s), e.g.
    # "https://your-app.vercel.app,https://yourdomain.com"
    cors_origins: str = "http://localhost:3000"
    # Also allow Vercel's per-branch preview URLs (*.vercel.app).
    allow_vercel_previews: bool = True

    # Seed ~N demo properties on first run so the app is usable immediately.
    # Turn seeding OFF in production so fake listings never touch a real database.
    seed_demo_data: bool = True
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

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() in ("production", "prod")

    def validate_for_production(self) -> None:
        """Fail fast on misconfiguration that would be unsafe or broken in production.

        Called at startup. Better to refuse to boot than to serve traffic with a
        publicly-known signing key or a database that vanishes on redeploy.
        """
        if not self.is_production:
            return

        problems = []
        if self.secret_key == DEV_SECRET or len(self.secret_key) < 32:
            problems.append(
                "SECRET_KEY is the shipped default or too short — anyone could forge a login "
                "token. Set a long random value (`openssl rand -hex 32`)."
            )
        if self.async_database_url.startswith("sqlite"):
            problems.append(
                "DATABASE_URL points at SQLite. Most hosts have an ephemeral filesystem, so "
                "every deploy would wipe your data. Use a managed Postgres URL."
            )
        if not self.cors_origin_list:
            problems.append("CORS_ORIGINS is empty — the frontend would be blocked by the browser.")
        if any(o == "*" for o in self.cors_origin_list):
            problems.append(
                "CORS_ORIGINS is '*', which cannot be combined with credentialed requests. "
                "List your exact frontend origin(s) instead."
            )
        if self.debug:
            problems.append("DEBUG=true leaks SQL and stack traces. Set DEBUG=false.")

        if problems:
            raise RuntimeError(
                "Refusing to start in production:\n"
                + "\n".join(f"  - {p}" for p in problems)
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()
