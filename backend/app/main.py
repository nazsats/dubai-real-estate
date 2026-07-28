"""FastAPI application entrypoint for the Dubai AI Broker Assistant."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import ai, analytics, auth, briefing, deals, health, leads, pipeline, properties, tasks
from app.config import get_settings
from app.db import SessionLocal, init_db
from app.seed import seed_if_empty

log = logging.getLogger("uvicorn.error")
settings = get_settings()

# Vercel gives every branch/PR its own preview URL. Allow them so preview
# deployments can talk to the API without re-listing each origin by hand.
VERCEL_PREVIEW_RE = r"https://.*\.vercel\.app"


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Refuse to boot on unsafe production config (weak secret, SQLite, open CORS).
    settings.validate_for_production()

    if settings.auto_create_tables:
        await init_db()

    # Demo seeding writes ~2k fake listings. Never do that to a production database.
    if settings.seed_demo_data:
        async with SessionLocal() as session:
            await seed_if_empty(session)
    else:
        log.info("Demo seeding disabled (SEED_DEMO_DATA=false).")

    log.info("Started in %s mode. CORS origins: %s", settings.environment, settings.cors_origin_list)
    yield


app = FastAPI(
    title="Dubai AI Broker Assistant",
    description="AI broker assistant for Dubai real-estate agents — CRM, search, match, pitch, marketing.",
    version="0.3.0",
    lifespan=lifespan,
    # Hide the interactive docs in production unless explicitly re-enabled.
    docs_url="/docs" if settings.enable_docs else None,
    redoc_url="/redoc" if settings.enable_docs else None,
    openapi_url="/openapi.json" if settings.enable_docs else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=VERCEL_PREVIEW_RE if settings.allow_vercel_previews else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (health, auth, properties, leads, pipeline, tasks, deals, analytics, briefing, ai):
    app.include_router(module.router)


@app.get("/")
async def root():
    return {
        "name": "Dubai AI Broker Assistant",
        "status": "ok",
        "docs": "/docs" if settings.enable_docs else "disabled",
    }
