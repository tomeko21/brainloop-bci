"""All tables. Created by create_all on startup, no migrations."""

from pathlib import PurePosixPath

from sqlalchemy import BigInteger, Boolean, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


# Maps the existing videos table (same columns as reels_metadata.csv), create_all never alters it.
class Reel(Base):
    __tablename__ = "videos"

    filename: Mapped[str] = mapped_column(Text, primary_key=True)  # relative to VIDEOS_DIR
    youtube_id: Mapped[str | None] = mapped_column(String)
    title: Mapped[str | None] = mapped_column(Text)
    uploader: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String)
    stim_level: Mapped[str | None] = mapped_column(String)  # low | medium | high
    is_vertical: Mapped[bool | None] = mapped_column(Boolean)
    tags: Mapped[str | None] = mapped_column(Text)  # comma-separated
    duration: Mapped[float | None] = mapped_column(Float)
    fps: Mapped[float | None] = mapped_column(Float)
    cuts_per_sec: Mapped[float | None] = mapped_column(Float)
    motion_score: Mapped[float | None] = mapped_column(Float)
    flashes_per_sec: Mapped[float | None] = mapped_column(Float)
    audio_mean_db: Mapped[float | None] = mapped_column(Float)
    audio_max_db: Mapped[float | None] = mapped_column(Float)
    audio_dynamic_range: Mapped[float | None] = mapped_column(Float)
    view_count: Mapped[int | None] = mapped_column(BigInteger)
    engagement_rate: Mapped[float | None] = mapped_column(Float)
    objective_stim_score: Mapped[float | None] = mapped_column(Float)
    hybrid_brainrot_score: Mapped[float | None] = mapped_column(Float)

    @property
    # API id is the file stem, e.g. chaotic_memes_012
    def id(self) -> str:
        return PurePosixPath(self.filename).stem

    @property
    def tag_list(self) -> list[str]:
        return [t.strip() for t in (self.tags or "").split(",") if t.strip()]


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    subject_name: Mapped[str] = mapped_column(String(100), index=True)
    camera_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    started_at_ms: Mapped[int] = mapped_column(BigInteger)
    ended_at_ms: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    folder: Mapped[str] = mapped_column(String(255))  # under DATA_DIR/sessions/
    video_files: Mapped[list[str]] = mapped_column(JSONB, default=list)


class ReelImpression(Base):
    __tablename__ = "reel_impressions"
    __table_args__ = (UniqueConstraint("session_id", "stream", "position"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    reel_id: Mapped[str] = mapped_column(String(120))
    stream: Mapped[str] = mapped_column(String(16), default="main")
    position: Mapped[int] = mapped_column(Integer)
    served_at_ms: Mapped[int] = mapped_column(BigInteger)
    reason: Mapped[str] = mapped_column(
        String(120), default=""
    )  # selector debug string, see reel_selector.select_batch


class Like(Base):
    __tablename__ = "likes"
    __table_args__ = (UniqueConstraint("subject_name", "reel_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subject_name: Mapped[str] = mapped_column(String(100), index=True)
    reel_id: Mapped[str] = mapped_column(String(120))
    liked: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at_ms: Mapped[int] = mapped_column(BigInteger)


# ReelView and Event rows are imported from the session CSVs in routers/sessions.upload_dataset
class ReelView(Base):
    __tablename__ = "reel_views"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    reel_id: Mapped[str] = mapped_column(String(80))
    view_start_ms: Mapped[int] = mapped_column(BigInteger)
    dwell_ms: Mapped[int] = mapped_column(BigInteger)
    played_ms: Mapped[int] = mapped_column(BigInteger)
    watch_pct: Mapped[float] = mapped_column(Float)
    completed_loops: Mapped[int] = mapped_column(Integer)
    liked: Mapped[bool] = mapped_column(Boolean)
    exit_direction: Mapped[str] = mapped_column(String(16))
    exit_scroll_speed: Mapped[float] = mapped_column(Float)


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    ts_ms: Mapped[int] = mapped_column(BigInteger)
    t_rel_ms: Mapped[int] = mapped_column(BigInteger)
    type: Mapped[str] = mapped_column(String(40))
    reel_id: Mapped[str] = mapped_column(String(80), default="")
    value: Mapped[str] = mapped_column(String(200), default="")


# One row per POST /api/ml/predict-window, the training set for a camera model.
class Window(Base):
    __tablename__ = "windows"
    __table_args__ = (Index("ix_windows_session_ts", "session_id", "ts_ms"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"))
    ts_ms: Mapped[int] = mapped_column(BigInteger)
    client_features: Mapped[dict] = mapped_column(JSONB)  # browser MediaPipe + scroll window
    video_features: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True
    )  # server-side OpenCV summary of camera frames
    bri_ai: Mapped[float | None] = mapped_column(Float, nullable=True)  # camera model, None until one exists
    bri_eeg: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )  # EEG BRI at the same moment, i.e. the label
    should_stop: Mapped[bool] = mapped_column(Boolean)
    model_version: Mapped[str] = mapped_column(String(60))


# Empty until a camera model is trained.
class MlModel(Base):
    __tablename__ = "models"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at_ms: Mapped[int] = mapped_column(BigInteger)
    accuracy_loso: Mapped[float | None] = mapped_column(Float, nullable=True)
    artifact_path: Mapped[str] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
