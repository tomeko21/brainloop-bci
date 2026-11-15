"""App factory. Startup creates tables, seeds reels, starts the EEG hub and the live BRI loop."""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.brainrot import service as brainrot_service
from app.brainrot.engine import LiveBrainRot
from app.config import get_settings
from app.db import create_tables
from app.eeg import hub as eeg_hub
from app.eeg.eeg_source import EegSource
from app.routers import brainrot, eeg, feed, health, live, ml, sessions, users
from app.seed import seed_reels

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("brainloop")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    settings.data_path.mkdir(parents=True, exist_ok=True)
    await create_tables()
    await seed_reels()
    eeg_hub.hub = eeg_hub.EegHub(
        EegSource(settings.eeg_channel_names, settings.eeg_lsl_stream, settings.eeg_lsl_allow_remote)
    )
    # loading the model and data_acc takes a few seconds, keep it off the event loop
    engine = await asyncio.to_thread(LiveBrainRot, settings.live_model_file, settings.data_acc_path)
    # every raw EEG chunk is also fed to the live BRI engine
    eeg_hub.hub.source.on_chunk = engine.add_eeg
    brainrot_service.service = brainrot_service.BrainRotService(engine)
    await brainrot_service.service.start()
    await eeg_hub.hub.start()
    log.info("Data dir: %s | videos: %s", settings.data_path, settings.videos_path)
    yield
    await brainrot_service.service.stop()
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
    for r in (
        health.router,
        feed.router,
        sessions.router,
        live.router,
        users.router,
        eeg.router,
        ml.router,
        brainrot.router,
    ):
        app.include_router(r)
    # reel files; StaticFiles handles Range requests so seeking works
    app.mount("/media/videos", StaticFiles(directory=settings.videos_path, check_dir=False), name="videos")
    return app


app = create_app()
