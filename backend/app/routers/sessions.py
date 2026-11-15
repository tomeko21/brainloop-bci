"""Session lifecycle, recording and CSV uploads, live camera frames."""

import csv
import io
import logging
import secrets
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import delete

from app.config import get_settings
from app.deps import DbDep, get_session_or_404
from app.eeg.hub import get_hub
from app.ml.video_features import SessionFrameAnalyzer, aggregate
from app.models import Event, ReelView
from app.models import Session as SessionModel
from app.schemas import (
    EndSessionIn,
    EndSessionOut,
    RecordingMeta,
    SessionInfo,
    StartSessionIn,
    StartSessionOut,
    StorageStatusOut,
    UploadDatasetIn,
    UploadDatasetOut,
    UploadFramesOut,
    UploadRecordingOut,
    VideoFeatures,
)
from app.services import storage
from app.services.live_state import live_state
from app.utils import now_ms

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["sessions"])

# one per session, keeps the previous frame for motion
_analyzers: dict[str, SessionFrameAnalyzer] = {}


def _info(s: SessionModel) -> SessionInfo:
    return SessionInfo.model_validate(s)


@router.post("/sessions", response_model=StartSessionOut)
async def start_session(body: StartSessionIn, db: DbDep) -> StartSessionOut:
    now = now_ms()
    session_id = f"ses_{secrets.token_hex(4)}"
    s = SessionModel(
        id=session_id,
        subject_name=body.subject_name.strip(),
        camera_enabled=body.camera_enabled,
        started_at_ms=now,
        folder=storage.session_folder_name(session_id, body.subject_name, now),
        video_files=[],
    )
    db.add(s)
    await db.commit()
    # raw EEG goes to <session folder>/eeg_raw.csv until stop
    get_hub().start_recording(session_id, get_settings().data_path / "sessions" / s.folder)
    log.info("Session %s started for %s", session_id, s.subject_name)
    return StartSessionOut(session=_info(s), server_utc_ms=now)


@router.post("/sessions/{session_id}/stop", response_model=EndSessionOut)
async def stop_session(session_id: str, body: EndSessionIn, db: DbDep) -> EndSessionOut:
    s = await get_session_or_404(db, session_id)
    s.ended_at_ms = body.ended_at_ms
    await db.commit()
    get_hub().stop_recording(session_id)
    _analyzers.pop(session_id, None)
    entry = live_state.entries.get(session_id)
    if entry:
        entry.heartbeat.left = True
    return EndSessionOut(session=_info(s))


@router.post("/sessions/{session_id}/recording", response_model=UploadRecordingOut)
async def upload_recording(
    session_id: str,
    db: DbDep,
    video: Annotated[UploadFile, File()],
    started_at_ms: Annotated[int, Form()],
    ended_at_ms: Annotated[int, Form()],
) -> UploadRecordingOut:
    """One .webm segment, the file name carries start/end timestamps."""
    s = await get_session_or_404(db, session_id)
    ext = "mp4" if (video.content_type or "").endswith("mp4") else "webm"
    name = f"recording_{session_id}_{started_at_ms}_{ended_at_ms}.{ext}"
    path = await run_in_threadpool(storage.save_stream, s.folder, name, video.file)
    if name not in s.video_files:
        s.video_files = [*s.video_files, name]
    await db.commit()
    return UploadRecordingOut(
        recording=RecordingMeta(
            session_id=session_id,
            file_name=name,
            mime_type=video.content_type or "video/webm",
            size_bytes=path.stat().st_size,
            started_at_ms=started_at_ms,
            ended_at_ms=ended_at_ms,
        ),
        saved_to=storage.relative_to_project(path),
    )


def _rows(csv_text: str) -> list[dict[str, str]]:
    return list(csv.DictReader(io.StringIO(csv_text)))


def _int(v: str | None) -> int:
    try:
        return int(float(v)) if v else 0
    except ValueError:
        return 0


@router.post("/sessions/{session_id}/dataset", response_model=UploadDatasetOut)
async def upload_dataset(session_id: str, body: UploadDatasetIn, db: DbDep) -> UploadDatasetOut:
    """All session CSVs: saved, appended to data/dataset/, views and events imported."""
    s = await get_session_or_404(db, session_id)
    accepted: dict[str, int] = {}
    dataset: dict[str, int | str] = {}
    try:
        for f in body.files:
            accepted[f.name] = max(0, f.csv.strip().count("\n"))
            await run_in_threadpool(storage.save_text, s.folder, f.name, f.csv)
            table = f.name.removesuffix(".csv")
            dataset[f.name] = await run_in_threadpool(storage.append_to_dataset, table, session_id, f.csv)
    except storage.InvalidFileName as e:
        raise HTTPException(400, f"Invalid file name: {e}") from e

    # a re-upload replaces this session's rows
    files = {f.name: f.csv for f in body.files}
    if "reel_views.csv" in files:
        await db.execute(delete(ReelView).where(ReelView.session_id == session_id))
        db.add_all(
            ReelView(
                session_id=session_id,
                reel_id=r["reel_id"],
                view_start_ms=_int(r.get("view_start_ms")),
                dwell_ms=_int(r.get("dwell_ms")),
                played_ms=_int(r.get("played_ms")),
                watch_pct=float(r.get("watch_pct") or 0),
                completed_loops=_int(r.get("completed_loops")),
                liked=r.get("liked") == "1",
                exit_direction=r.get("exit_direction", ""),
                exit_scroll_speed=float(r.get("exit_scroll_speed_reels_s") or 0),
            )
            for r in _rows(files["reel_views.csv"])
        )
    if "events.csv" in files:
        await db.execute(delete(Event).where(Event.session_id == session_id))
        db.add_all(
            Event(
                session_id=session_id,
                ts_ms=_int(r.get("ts_ms")),
                t_rel_ms=_int(r.get("t_rel_ms")),
                type=r.get("event", ""),
                reel_id=r.get("reel_id", ""),
                value=(r.get("value") or "")[:200],
            )
            for r in _rows(files["events.csv"])
        )
    await db.commit()

    folder_path = get_settings().data_path / "sessions" / s.folder
    return UploadDatasetOut(
        accepted=accepted, saved_to=storage.relative_to_project(folder_path), dataset=dataset
    )


@router.post("/sessions/{session_id}/frames", response_model=UploadFramesOut)
async def upload_frames(
    session_id: str,
    db: DbDep,
    frames: Annotated[list[UploadFile], File()],
    timestamps: Annotated[str, Form()],
) -> UploadFramesOut:
    """Batch of JPEG frames (~2 fps), analyzed with OpenCV and optionally saved."""
    settings = get_settings()
    s = await get_session_or_404(db, session_id)
    ts = [int(t) for t in timestamps.split(",") if t.strip()]
    if len(ts) != len(frames):
        raise HTTPException(400, "timestamps must match the number of frames")

    analyzer = _analyzers.setdefault(session_id, SessionFrameAnalyzer())
    results = []
    for upload, t in zip(frames, ts, strict=True):
        data = await upload.read()
        if len(data) > settings.frame_max_bytes:
            continue
        if settings.save_frames:
            await run_in_threadpool(storage.save_frame, s.folder, t, data)
        r = await run_in_threadpool(analyzer.analyze, data, t)
        if r:
            results.append(r)

    summary = aggregate(results)
    if not summary:
        raise HTTPException(400, "No decodable frames")
    features = VideoFeatures(**summary)
    live_state.video_by_session[session_id] = features
    return UploadFramesOut(accepted=len(results), features=features)


@router.get("/storage/status", response_model=StorageStatusOut)
async def storage_status() -> StorageStatusOut:
    return StorageStatusOut(mode="backend", location=str(get_settings().data_path))
