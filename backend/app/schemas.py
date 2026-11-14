"""Pydantic models = the API contract.

JSON uses camelCase (matches frontend/src/types). Python code uses snake_case.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# ---------------------------------------------------------------- reels / feed
ReelMood = Literal["calm", "neutral", "intense"]


class ReelAuthor(ApiModel):
    handle: str
    avatar_hue: int
    verified: bool


class ReelMetrics(ApiModel):
    cuts_per_sec: float
    motion_score: float
    flashes_per_sec: float
    objective_stim_score: float
    brainrot_score: float  # hybrid_brainrot_score from the dataset (≈1.5–9)


class ReelOut(ApiModel):
    id: str
    author: ReelAuthor
    caption: str
    tags: list[str]
    duration_sec: float
    palette: tuple[int, int]
    mood: ReelMood
    likes: int
    comments: int
    liked_by_me: bool
    created_at: str
    video_url: str
    category: str
    stim_level: str
    metrics: ReelMetrics


class FeedPage(ApiModel):
    items: list[ReelOut]
    next_cursor: int | None


class ToggleLikeIn(ApiModel):
    session_id: str
    like: bool


class ToggleLikeOut(ApiModel):
    reel_id: str
    likes: int
    liked_by_me: bool


# ---------------------------------------------------------------- sessions
class StartSessionIn(ApiModel):
    subject_name: str = Field(min_length=1, max_length=100)
    camera_enabled: bool = False


class SessionInfo(ApiModel):
    id: str
    subject_name: str
    started_at_ms: int
    ended_at_ms: int | None
    camera_enabled: bool


class StartSessionOut(ApiModel):
    session: SessionInfo
    server_utc_ms: int


class EndSessionIn(ApiModel):
    ended_at_ms: int


class EndSessionOut(ApiModel):
    session: SessionInfo


class RecordingMeta(ApiModel):
    session_id: str
    file_name: str
    mime_type: str
    size_bytes: int
    started_at_ms: int
    ended_at_ms: int


class UploadRecordingOut(ApiModel):
    recording: RecordingMeta
    saved_to: str | None


class CsvFile(ApiModel):
    name: str
    csv: str


class UploadDatasetIn(ApiModel):
    files: list[CsvFile]


class UploadDatasetOut(ApiModel):
    accepted: dict[str, int]
    saved_to: str | None
    dataset: dict[str, int | Literal["skipped"]]


class StorageStatusOut(ApiModel):
    mode: Literal["local", "backend", "none"]
    location: str | None


# ---------------------------------------------------------------- camera frames
class VideoFeatures(ApiModel):
    """Features computed on the server from camera frames (OpenCV)."""

    frames: int
    face_present_ratio: float
    brightness: float  # 0..255
    motion: float  # mean abs frame difference 0..255
    face_area: float | None  # face box area / frame area
    forehead_rgb: tuple[float, float, float] | None
    window_start_ms: int
    window_end_ms: int


class UploadFramesOut(ApiModel):
    accepted: int
    features: VideoFeatures


# ---------------------------------------------------------------- live
class PlaybackSnapshot(ApiModel):
    position_ms: float
    duration_ms: float
    loops: int
    paused: bool


class FaceLiveSummary(ApiModel):
    present: bool
    ear_avg: float | None = None
    blink_rate_per_min: float | None = None
    perclos: float | None = None
    pitch_deg: float | None = None
    yaw_deg: float | None = None
    roll_deg: float | None = None
    jaw_open: float | None = None
    fps: float | None = None
    inference_ms: float | None = None


class MlFactor(ApiModel):
    feature: str
    contribution: float


class MlPrediction(ApiModel):
    """Answer of POST /api/ml/predict-window."""

    # BRI from the camera model – None until the model is trained (see app/ml/predictor.py)
    bri: float | None
    # BRI from the EEG headset at the same moment (None when no headset streams)
    bri_eeg: float | None = None
    # True when the best available BRI (camera, else EEG) crossed the break threshold
    should_stop: bool
    model_version: str
    top_factors: list[MlFactor]
    predicted_at_ms: int


class LiveEvent(ApiModel):
    """A row of the browser's events.csv, sent along with the heartbeat (for the admin's event stream)."""

    session_id: str
    subject_name: str
    event: str
    reel_id: str = ""
    ts_ms: int
    t_rel_ms: int
    value: str = ""


class ActiveReelIn(ApiModel):
    session_id: str
    subject_name: str
    reel_id: str
    reel_index: int
    playback: PlaybackSnapshot
    visible: bool
    left: bool = False
    face: FaceLiveSummary | None = None
    prediction: MlPrediction | None = None
    # Events logged since the previous heartbeat
    events: list[LiveEvent] = []
    # Calm filter intensity 0..1 on the viewer's device (the admin mirror applies the same effect)
    calm_intensity: float = 0.0


class ActiveReelOut(ApiModel):
    ok: bool = True
    received_at_ms: int


ViewerStatus = Literal["online", "background", "offline"]


class LiveViewerOut(ApiModel):
    status: ViewerStatus
    session_id: str | None = None
    subject_name: str | None = None
    reel: ReelOut | None = None
    reel_index: int = 0
    last_seen_ms_ago: int | None = None
    view_started_at_ms: int | None = None
    playback: PlaybackSnapshot | None = None
    heartbeat_at_ms: int | None = None
    face: FaceLiveSummary | None = None
    prediction: MlPrediction | None = None
    video: VideoFeatures | None = None
    calm_intensity: float = 0.0


# ---------------------------------------------------------------- users
class UserProfile(ApiModel):
    subject_name: str
    role: Literal["subject", "admin"]
    device_id: str
    joined_at: str
    avatar_hue: int


class UserStats(ApiModel):
    reels_watched: int
    likes_given: int
    avg_watch_time_sec: float
    total_session_time_sec: float
    avg_fatigue: float
    focus_trend: list[float]


# ---------------------------------------------------------------- ML
class MlFeatureWindow(ApiModel):
    """10 s window computed in the browser (MediaPipe + scroll). NaN is sent as null."""

    session_id: str
    window_start_ms: int
    window_end_ms: int
    face_present_ratio: float | None = None
    ear_mean: float | None = None
    blink_rate_per_min: float | None = None
    perclos: float | None = None
    head_pitch_mean: float | None = None
    head_motion: float | None = None
    jaw_open_max: float | None = None
    scroll_speed_mean: float | None = None
    scroll_samples: int = 0
    dwell_mean_sec: float | None = None
    watch_pct_mean: float | None = None
    likes_in_window: int = 0


# ---------------------------------------------------------------- EEG headset
class EegRecordingOut(ApiModel):
    session_id: str | None
    file: str | None
    samples: int


class EegStreamInfo(ApiModel):
    """A BrainAccess EEG stream published by BrainAccess Board (LSL)."""

    name: str
    device: str
    channels: int
    sample_rate: float


class EegBaselineOut(ApiModel):
    """Result of the fixation-cross baseline (POST /api/eeg/baseline/start|finish)."""

    ok: bool
    clean_seconds: float  # seconds of artifact-free signal collected while the cross was shown
    baseline_ratio: float | None  # resting (theta + alpha) / beta of this person


class EegStatusOut(ApiModel):
    """EEG headset status (GET /api/eeg/status)."""

    source: str  # "brainaccess"
    # "board" = listening to BrainAccess Board (LSL) | "direct" = connected by our backend via the SDK
    mode: str = "board"
    # waiting | connected (Board stream, no data yet) | connecting (direct) | streaming | stalled
    # | error | disconnected
    state: str
    device: str | None = None
    stream: str | None = None
    battery: int | None = None
    sample_rate: int | None = None
    electrodes: int | None = None
    has_accel: bool | None = None
    channel_names: list[str] = []
    available: list[EegStreamInfo] = []
    error: str | None = None
    hint: str | None = None
    last_data_ms_ago: int | None = None
    recording: EegRecordingOut | None = None


class EegScanOut(ApiModel):
    devices: list[str]
    error: str | None = None
    hint: str | None = None


class EegConnectIn(ApiModel):
    device_name: str = Field(min_length=1, max_length=100)


class EegSelectIn(ApiModel):
    stream_name: str = Field(min_length=1, max_length=200)


# ---------------------------------------------------------------- health
class HealthOut(ApiModel):
    status: Literal["ok", "degraded"]
    db: bool
    reels: int
    active_reels: int
    model_version: str
