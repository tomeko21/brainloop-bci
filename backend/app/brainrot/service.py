"""Ticks the live BRI engine every TICK_S in a worker thread and pushes the state to /ws/brainrot clients."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time

from app.brainrot import tuning as T
from app.brainrot.engine import LiveBrainRot

log = logging.getLogger(__name__)


class BrainRotService:
    def __init__(self, engine: LiveBrainRot) -> None:
        self.engine = engine
        self._subs: set[asyncio.Queue[dict]] = set()
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        self._task = asyncio.create_task(self._run(), name="brainrot-live")

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task

    @contextlib.contextmanager
    def subscribe(self):
        q: asyncio.Queue[dict] = asyncio.Queue(maxsize=4)
        self._subs.add(q)
        try:
            yield q
        finally:
            self._subs.discard(q)

    def _publish(self, state: dict) -> None:
        for q in list(self._subs):
            if q.full():
                with contextlib.suppress(asyncio.QueueEmpty):
                    q.get_nowait()
            q.put_nowait(state)

    async def _run(self) -> None:
        next_t = time.monotonic()
        while True:
            next_t += T.TICK_S
            try:
                state = await asyncio.to_thread(self.engine.tick)
                self._publish(state)
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("live BRI tick failed")
            delay = next_t - time.monotonic()
            # tick overran, skip ahead instead of piling up delay
            if delay < 0:
                next_t = time.monotonic()
                delay = 0
            await asyncio.sleep(delay)


service: BrainRotService | None = None


def get_service() -> BrainRotService:
    if service is None:
        raise RuntimeError("Brain Rot service not started")
    return service
