"""BrainLoop API.

Run:  uv run uvicorn app.main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.db import create_tables
from app.eeg import hub as eeg_hub
from app.eeg.eeg_source import EegSource
from app.routers import eeg, feed, health, live, ml, sessions, users
from app.seed import seed_reels

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("brainloop")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    settings.data_path.mkdir(parents=True, exist_ok=True)
    await create_tables()
    await seed_reels()
    # EEG: BrainAccess Board stream (automatic) or a direct SDK connection (user clicks Connect)
    eeg_hub.hub = eeg_hub.EegHub(
        EegSource(settings.eeg_channel_names, settings.eeg_lsl_stream, settings.eeg_lsl_allow_remote)
    )
    await eeg_hub.hub.start()
    log.info("Data dir: %s | videos: %s", settings.data_path, settings.videos_path)
    yield
    await eeg_hub.hub.stop()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="BrainLoop API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    for r in (health.router, feed.router, sessions.router, live.router, users.router, eeg.router, ml.router):
        app.include_router(r)
    # Reel videos (supports HTTP Range – seeking works in every browser)
    app.mount("/media/videos", StaticFiles(directory=settings.videos_path, check_dir=False), name="videos")
    return app


app = create_app()
