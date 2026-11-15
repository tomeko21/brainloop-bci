"""EEG headset endpoints. Board mode is picked up automatically, direct mode uses /scan + /connect."""

import asyncio
import json
import logging

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse

from app.eeg.hub import get_hub
from app.schemas import EegBaselineOut, EegConnectIn, EegScanOut, EegSelectIn, EegStatusOut

log = logging.getLogger(__name__)
router = APIRouter(tags=["eeg"])

KEEPALIVE_S = 15  # s, SSE comment so proxies don't drop an idle stream


def _status() -> EegStatusOut:
    st = get_hub().status()
    known = set(EegStatusOut.model_fields)
    return EegStatusOut(**{k: v for k, v in st.items() if k in known})


@router.get("/api/eeg/status", response_model=EegStatusOut)
async def eeg_status() -> EegStatusOut:
    """Polled by the frontend: state, battery, recording."""
    return _status()


@router.post("/api/eeg/scan", response_model=EegScanOut)
async def eeg_scan() -> EegScanOut:
    """Bluetooth scan, ~5 s. Headsets connected in Board are not visible."""
    return EegScanOut(**await get_hub().source.scan())


@router.post("/api/eeg/connect", response_model=EegStatusOut)
async def eeg_connect(body: EegConnectIn) -> EegStatusOut:
    """Connect directly with the SDK, pauses Board listening."""
    get_hub().source.connect_direct(body.device_name)
    return _status()


@router.post("/api/eeg/disconnect", response_model=EegStatusOut)
async def eeg_disconnect() -> EegStatusOut:
    await asyncio.to_thread(get_hub().source.disconnect_direct)
    return _status()


@router.post("/api/eeg/select", response_model=EegStatusOut)
async def eeg_select(body: EegSelectIn) -> EegStatusOut:
    get_hub().source.select(body.stream_name)
    return _status()


@router.post("/api/eeg/baseline/start", response_model=EegBaselineOut)
async def eeg_baseline_start() -> EegBaselineOut:
    get_hub().source.processor.start_fixation()
    return EegBaselineOut(ok=True, clean_seconds=0, baseline_ratio=None)


@router.post("/api/eeg/baseline/finish", response_model=EegBaselineOut)
async def eeg_baseline_finish() -> EegBaselineOut:
    """ok=false means too little clean signal, BRI keeps auto-calibrating."""
    return EegBaselineOut(**get_hub().source.processor.finish_fixation())


@router.get("/api/eeg/stream")
async def eeg_stream(request: Request, session_id: str | None = None) -> StreamingResponse:
    """SSE, one message per snapshot (format in app/eeg/processing.py)."""
    hub = get_hub()

    async def gen():
        with hub.subscribe() as queue:
            # flush headers right away so the browser sees the stream as open
            yield ": connected\n\n"
            if latest := hub.fresh_latest():
                yield f"data: {json.dumps(latest)}\n\n"
            while not await request.is_disconnected():
                try:
                    snapshot = await asyncio.wait_for(queue.get(), timeout=KEEPALIVE_S)
                    yield f"data: {json.dumps(snapshot)}\n\n"
                except TimeoutError:
                    yield ": keep-alive\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.websocket("/ws/eeg/live")
async def eeg_live_ws(ws: WebSocket) -> None:
    """Same snapshots over WebSocket (frontend VITE_EEG_TRANSPORT=ws)."""
    await ws.accept()
    hub = get_hub()
    try:
        with hub.subscribe() as queue:
            while True:
                await ws.send_json(await queue.get())
    except WebSocketDisconnect:
        pass
