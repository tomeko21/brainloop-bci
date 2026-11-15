"""Live view for the admin panel (frontend/src/api/admin.api.ts)."""

from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import DbDep
from app.schemas import ActiveReelIn, ActiveReelOut, LiveEvent, LiveViewerOut
from app.services.catalog import get_reel
from app.services.live_state import live_state
from app.services.reels import to_reel_out
from app.utils import now_ms

router = APIRouter(prefix="/api/live", tags=["live"])


@router.post("/active-reel", response_model=ActiveReelOut)
async def report_active_reel(body: ActiveReelIn) -> ActiveReelOut:
    """Heartbeat from the feed, every ~2 s and on pause/visibility change."""
    return ActiveReelOut(received_at_ms=live_state.report(body))


@router.get("/viewer", response_model=LiveViewerOut)
async def live_viewer(db: DbDep, session_id: str | None = None) -> LiveViewerOut:
    entry = live_state.get(session_id)
    if entry is None:
        return LiveViewerOut(status="offline")
    hb = entry.heartbeat
    reel = await get_reel(db, hb.reel_id)
    return LiveViewerOut(
        status=live_state.status(entry),
        session_id=hb.session_id,
        subject_name=hb.subject_name,
        reel=to_reel_out(reel, False) if reel else None,
        reel_index=hb.reel_index,
        last_seen_ms_ago=now_ms() - entry.heartbeat_at_ms,
        view_started_at_ms=entry.view_started_at_ms,
        playback=hb.playback,
        heartbeat_at_ms=entry.heartbeat_at_ms,
        face=hb.face,
        prediction=live_state.prediction_by_session.get(hb.session_id) or hb.prediction,
        video=live_state.video_by_session.get(hb.session_id),
        calm_intensity=hb.calm_intensity,
    )


@router.get("/events", response_model=list[LiveEvent])
async def live_events(
    session_id: str | None = None, limit: Annotated[int, Query(ge=1, le=300)] = 20
) -> list[LiveEvent]:
    """Latest events of a session, newest first."""
    return live_state.recent_events(session_id, limit)
