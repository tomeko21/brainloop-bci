"""All database tables in one place (hackathon rule: no repositories, no migrations)."""

from pathlib import PurePosixPath

from sqlalchemy import BigInteger, Boolean, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Reel(Base):
    """A reel = a row of YOUR existing `public.videos` table (same columns as reels_metadata.csv).

    The schema is owned by you (pgAdmin) – this model only maps it, `create_all` never alters it.
    API id = file name without extension (e.g. "chaotic_memes_012"); the primary key is `filename`.
    """

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
    def id(self) -> str:
        return PurePosixPath(self.filename).stem

    @property
    def tag_list(self) -> list[str]:
        return [t.strip() for t in (self.tags or "").split(",") if t.strip()]


class Session(Base):
    """One measurement session (no accounts – just the subject's name)."""

    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    subject_name: Mapped[str] = mapped_column(String(100), index=True)
    camera_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    started_at_ms: Mapped[int] = mapped_column(BigInteger)
    ended_at_ms: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    # Folder in DATA_DIR/sessions/ with all files of this session
    folder: Mapped[str] = mapped_column(String(255))
    video_files: Mapped[list[str]] = mapped_column(JSONB, default=list)


class ReelImpression(Base):
    """Reels served to a session, in order. Used for paging and to avoid repeats."""

    __tablename__ = "reel_impressions"
    __table_args__ = (UniqueConstraint("session_id", "stream", "position"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    reel_id: Mapped[str] = mapped_column(String(120))  # = Reel.id (file stem)
    # Separate paging per feed variant ("main" / "calm"), so toggling the calm filter starts a fresh list
    stream: Mapped[str] = mapped_column(String(16), default="main")
    position: Mapped[int] = mapped_column(Integer)
    served_at_ms: Mapped[int] = mapped_column(BigInteger)
    # Why the selector picked it (target BRI, strategy) – handy when debugging recommendations
    reason: Mapped[str] = mapped_column(String(120), default="")


class Like(Base):
    __tablename__ = "likes"
    __table_args__ = (UniqueConstraint("subject_name", "reel_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subject_name: Mapped[str] = mapped_column(String(100), index=True)
    reel_id: Mapped[str] = mapped_column(String(120))  # = Reel.id (file stem)
    liked: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at_ms: Mapped[int] = mapped_column(BigInteger)


class ReelView(Base):
    """One watched reel (imported from reel_views.csv when the session is saved)."""

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
    """Discrete events (imported from events.csv)."""

    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    ts_ms: Mapped[int] = mapped_column(BigInteger)
    t_rel_ms: Mapped[int] = mapped_column(BigInteger)
    type: Mapped[str] = mapped_column(String(40))
    reel_id: Mapped[str] = mapped_column(String(80), default="")
    value: Mapped[str] = mapped_column(String(200), default="")


class Window(Base):
    """A 10 s feature window + model output (every ~2 s while a session is live)."""

    __tablename__ = "windows"
    __table_args__ = (Index("ix_windows_session_ts", "session_id", "ts_ms"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"))
    ts_ms: Mapped[int] = mapped_column(BigInteger)
    client_features: Mapped[dict] = mapped_column(JSONB)  # from the browser (MediaPipe + scroll)
    video_features: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # from camera frames (server)
    bri_ai: Mapped[float | None] = mapped_column(Float, nullable=True)  # camera model (None until trained)
    bri_eeg: Mapped[float | None] = mapped_column(Float, nullable=True)  # EEG label at the same time
    should_stop: Mapped[bool] = mapped_column(Boolean)
    model_version: Mapped[str] = mapped_column(String(60))


class MlModel(Base):
    """Trained model artifacts (e.g. LightGBM) – empty until the camera model is trained.

    TODO(team): after training, insert a row (artifact_path, accuracy_loso, is_active=True)
    and load the active artifact in app/ml/predictor.py (CameraBriModel). See TODO.md.
    """

    __tablename__ = "models"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at_ms: Mapped[int] = mapped_column(BigInteger)
    accuracy_loso: Mapped[float | None] = mapped_column(Float, nullable=True)
    artifact_path: Mapped[str] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
