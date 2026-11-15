"""In-memory live state per session. Fine for one uvicorn process, several workers would need Redis."""

from collections import deque
from dataclasses import dataclass, field

from app.schemas import ActiveReelIn, LiveEvent, MlPrediction, VideoFeatures
from app.utils import now_ms

OFFLINE_AFTER_MS = 8_000
EVENTS_PER_SESSION = 2_000
BACKGROUND_OFFLINE_AFTER_MS = 5 * 60_000  # browsers throttle background tabs, give them longer


@dataclass
class LiveEntry:
    heartbeat: ActiveReelIn
    heartbeat_at_ms: int
    view_started_at_ms: int
    video: VideoFeatures | None = None


@dataclass
class LiveState:
    entries: dict[str, LiveEntry] = field(default_factory=dict)
    video_by_session: dict[str, VideoFeatures] = field(default_factory=dict)
    prediction_by_session: dict[str, MlPrediction] = field(default_factory=dict)
    events_by_session: dict[str, deque[LiveEvent]] = field(default_factory=dict)
    latest_session_id: str | None = None

    def report(self, hb: ActiveReelIn) -> int:
        now = now_ms()
        prev = self.entries.get(hb.session_id)
        same_reel = prev is not None and prev.heartbeat.reel_id == hb.reel_id
        self.entries[hb.session_id] = LiveEntry(
            heartbeat=hb,
            heartbeat_at_ms=now,
            view_started_at_ms=prev.view_started_at_ms if same_reel and prev else now,
        )
        if hb.prediction:
            self.prediction_by_session[hb.session_id] = hb.prediction
        if hb.events:
            log = self.events_by_session.setdefault(hb.session_id, deque(maxlen=EVENTS_PER_SESSION))
            log.extend(hb.events)
        # events are kept in events_by_session already
        self.entries[hb.session_id].heartbeat = hb.model_copy(update={"events": []})
        self.latest_session_id = hb.session_id
        return now

    def status(self, entry: LiveEntry) -> str:
        ago = now_ms() - entry.heartbeat_at_ms
        if entry.heartbeat.left:
            return "offline"
        if not entry.heartbeat.visible:
            return "background" if ago < BACKGROUND_OFFLINE_AFTER_MS else "offline"
        return "online" if ago < OFFLINE_AFTER_MS else "offline"

    def get(self, session_id: str | None) -> LiveEntry | None:
        sid = session_id or self.latest_session_id
        return self.entries.get(sid) if sid else None

    def recent_events(self, session_id: str | None, limit: int) -> list[LiveEvent]:
        sid = session_id or self.latest_session_id
        log = self.events_by_session.get(sid) if sid else None
        return list(log)[-limit:][::-1] if log else []

    def latest_bri(self, session_id: str) -> float | None:
        p = self.prediction_by_session.get(session_id)
        if not p:
            return None
        return p.bri if p.bri is not None else p.bri_eeg


live_state = LiveState()
