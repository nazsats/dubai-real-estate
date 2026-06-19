"""FastAPI application entrypoint for the Dubai AI Broker Assistant."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import ai, analytics, auth, briefing, deals, health, leads, pipeline, properties, tasks
from app.config import get_settings
from app.db import SessionLocal, init_db
from app.seed import seed_if_empty

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.auto_create_tables:
        await init_db()
    async with SessionLocal() as session:
        await seed_if_empty(session)
    yield


app = FastAPI(
    title="Dubai AI Broker Assistant",
    description="AI broker assistant for Dubai real-estate agents — CRM, search, match, pitch, marketing.",
    version="0.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (health, auth, properties, leads, pipeline, tasks, deals, analytics, briefing, ai):
    app.include_router(module.router)


@app.get("/")
async def root():
    return {"name": "Dubai AI Broker Assistant", "docs": "/docs"}
