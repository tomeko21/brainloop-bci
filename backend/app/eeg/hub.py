"""One task reads the EEG source and fans snapshots out to SSE/WS subscribers (routers/eeg.py)."""

import asyncio
import contextlib
import logging
import time

from app.eeg.eeg_source import EegSource

log = logging.getLogger(__name__)


class EegHub:
    def __init__(self, source: EegSource) -> None:
        self.source = source
        self.latest: dict | None = None
        self._subscribers: set[asyncio.Queue[dict]] = set()
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        self._task = asyncio.create_task(self._run(), name="eeg-hub")

    async def stop(self) -> None:
        self.source.stop()
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task

    def fresh_latest(self, max_age_ms: int = 2_000) -> dict | None:
        if not self.latest:
            return None
        return self.latest if time.time() * 1000 - self.latest.get("tMs", 0) <= max_age_ms else None

    def status(self) -> dict:
        return self.source.get_status()

    def start_recording(self, session_id: str, folder) -> None:  # noqa: ANN001
        self.source.start_recording(session_id, folder)

    def stop_recording(self, session_id: str):  # noqa: ANN201
        return self.source.stop_recording(session_id)

    def publish(self, snapshot: dict) -> None:
        self.latest = snapshot
        for q in list(self._subscribers):
            # slow client drops its oldest snapshot instead of holding up the rest
            if q.full():
                with contextlib.suppress(asyncio.QueueEmpty):
                    q.get_nowait()
            q.put_nowait(snapshot)

    @contextlib.contextmanager
    def subscribe(self):
        q: asyncio.Queue[dict] = asyncio.Queue(maxsize=8)
        self._subscribers.add(q)
        try:
            yield q
        finally:
            self._subscribers.discard(q)

    async def _run(self) -> None:
        try:
            async for snapshot in self.source.stream():
                self.publish(snapshot)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("EEG source crashed")


hub: EegHub | None = None


def get_hub() -> EegHub:
    if hub is None:
        raise RuntimeError("EEG hub not started")
    return hub
