"""Live Brain Rot index. The frontend (services/brainrot/brainrotClient.ts) talks to /ws/brainrot."""

import asyncio
import contextlib
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.brainrot.service import get_service

log = logging.getLogger(__name__)
router = APIRouter(tags=["brainrot"])


class FaceFramesIn(BaseModel):
    frames: list[dict[str, Any]]


@router.get("/api/brainrot/status")
async def brainrot_status() -> dict:
    return get_service().engine.latest


@router.post("/api/brainrot/face")
async def brainrot_face(body: FaceFramesIn) -> dict:
    """HTTP fallback for the WS face message."""
    n = await asyncio.to_thread(get_service().engine.add_face_frames, body.frames)
    return {"accepted": n}


@router.post("/api/brainrot/baseline/start")
async def brainrot_baseline_start() -> dict:
    """Fixation cross is on screen, start collecting the personal baseline."""
    return get_service().engine.start_baseline()


@router.post("/api/brainrot/baseline/finish")
async def brainrot_baseline_finish() -> dict:
    return await asyncio.to_thread(get_service().engine.finish_baseline)


@router.websocket("/ws/brainrot")
async def brainrot_ws(ws: WebSocket) -> None:
    await ws.accept()
    svc = get_service()

    async def receive() -> None:
        while True:
            msg = await ws.receive_json()
            if isinstance(msg, dict) and msg.get("type") == "face" and isinstance(msg.get("frames"), list):
                await asyncio.to_thread(svc.engine.add_face_frames, msg["frames"])

    # every client gets the state each tick, read-only ones (admin) included
    async def send() -> None:
        with svc.subscribe() as q:
            if svc.engine.latest.get("tMs"):
                await ws.send_json(svc.engine.latest)
            while True:
                await ws.send_json(await q.get())

    tasks = [asyncio.create_task(receive()), asyncio.create_task(send())]
    try:
        await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    except WebSocketDisconnect:
        pass
    finally:
        for t in tasks:
            t.cancel()
            with contextlib.suppress(asyncio.CancelledError, WebSocketDisconnect, Exception):
                await t
