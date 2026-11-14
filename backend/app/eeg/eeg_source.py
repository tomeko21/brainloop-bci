"""EEG source – the real BrainAccess headset, two ways (no mock):

1. **Board mode (automatic):** the headset is connected in the BrainAccess Board app, which publishes it as
   an LSL stream ("BA MINI 074_MINI_BrainAccess", 22 ch: 8 × EEG µV, 8 × contact, 3 × accel, sample counter,
   streaming flag, battery). A background thread just LISTENS to it.
2. **Direct mode (user clicks Connect):** without Board, the BrainAccess SDK connects to the chosen headset
   in a child process (app/eeg/direct_worker.py). While direct mode is on, Board listening is paused.

States: waiting (nothing) · connected (Board stream found, no samples yet) · connecting (direct) ·
streaming · stalled (Board stream without data) · error/disconnected (direct).

Samples (both modes, same format) -> snapshots every 250 ms (app/eeg/processing.py) + raw recording
into the active session folder (app/eeg/recorder.py).
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import queue
import threading
import time
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import numpy as np

from app.eeg import tuning as T
from app.eeg.processing import SignalProcessor
from app.eeg.recorder import EegRecorder

log = logging.getLogger(__name__)

BT_PERMISSION_HINT = (
    "macOS blocked Bluetooth for the app that started the backend. Start the backend from Terminal / iTerm / "
    "VS Code and click 'Allow' (or System Settings → Privacy & Security → Bluetooth)."
)
RESOLVE_EVERY_S = 3.0  # look for Board's stream every N s while waiting (local network lookup, no Bluetooth)
STALL_AFTER_S = 3.0  # no samples for this long -> "stalled"


def _channels(info: Any) -> list[tuple[str, str]]:
    """(label, type) of every channel from the LSL stream description."""
    out: list[tuple[str, str]] = []
    ch = info.desc().child("channels").child("channel")
    while not ch.empty():
        out.append((ch.child_value("label"), ch.child_value("type").upper()))
        ch = ch.next_sibling()
    return out


def _is_local(info: Any) -> bool:
    """LSL sees streams of the whole local network – at a hackathon that includes other teams' headsets."""
    import socket

    def norm(h: str) -> str:
        return h.lower().removesuffix(".local")

    return norm(info.hostname()) == norm(socket.gethostname())


def _is_brainaccess(info: Any) -> bool:
    return (
        "brainaccess" in info.name().lower() or info.desc().child_value("manufacturer") == "Neurotechnology"
    )


class EegSource:
    name = "brainaccess"

    def __init__(
        self, fallback_names: list[str], preferred_stream: str = "", allow_remote: bool = False
    ) -> None:
        self.allow_remote = allow_remote
        self.fallback_names = fallback_names
        self.preferred = preferred_stream
        self.processor = SignalProcessor(fallback_names)
        self.recorder = EegRecorder()
        self.status: dict[str, Any] = {"state": "waiting"}
        self.available: list[dict[str, Any]] = []
        self.last_data_ms: int | None = None
        self._msgs: queue.Queue[dict] = queue.Queue(maxsize=2_000)
        self._stop = threading.Event()
        self.mode = "board"  # "board" (listen to BrainAccess Board) | "direct" (SDK connection)
        self._direct_proc: Any = None
        self._direct_out: Any = None
        self._direct_cmd: Any = None
        self._thread = threading.Thread(target=self._reader, name="eeg-lsl-reader", daemon=True)
        self._thread.start()

    # ------------------------------------------------------------------ status / control
    def get_status(self) -> dict[str, Any]:
        now = int(time.time() * 1000)
        return {
            **self.status,
            "source": self.name,
            "mode": self.mode,
            "available": self.available,
            "last_data_ms_ago": None if self.last_data_ms is None else now - self.last_data_ms,
            "recording": {
                "session_id": self.recorder.session_id,
                "file": str(self.recorder.path) if self.recorder.path else None,
                "samples": self.recorder.samples,
            }
            if self.recorder.active
            else None,
        }

    def select(self, stream_name: str) -> None:
        """Use this Board stream (when several headsets are connected in Board)."""
        self.preferred = stream_name
        self._switch = True

    def start_recording(self, session_id: str, folder: Path) -> Path:
        self.processor.reset_baseline()  # new session (possibly a new person) -> calibrate BRI again
        path = self.recorder.start(session_id, folder, self.fallback_names)
        log.info("EEG recording armed -> %s", path)
        return path

    def stop_recording(self, session_id: str) -> tuple[Path | None, int]:
        if self.recorder.session_id != session_id:
            return None, 0
        path, n = self.recorder.stop()
        if path and n == 0:  # no EEG during the session -> do not leave an empty file
            path.unlink(missing_ok=True)
            path = None
        log.info("EEG recording stopped: %s (%d samples)", path, n)
        return path, n

    def stop(self) -> None:
        self._stop.set()
        self.disconnect_direct()
        self.recorder.stop()

    # ------------------------------------------------------------------ direct mode (BrainAccess SDK)
    async def scan(self) -> dict[str, Any]:
        """One Bluetooth scan in a child process (~5 s). Headsets connected in Board are not visible."""
        import multiprocessing as mp

        from app.eeg.direct_worker import run_scan

        ctx = mp.get_context("spawn")
        out = ctx.Queue()
        proc = ctx.Process(target=run_scan, args=(out,), name="brainaccess-scan", daemon=True)
        proc.start()
        try:
            msg = await asyncio.to_thread(out.get, True, 20.0)
        except queue.Empty:
            proc.join(timeout=1)
            code = proc.exitcode
            if proc.is_alive():
                proc.terminate()
            hint = BT_PERMISSION_HINT if code in (134, -6) else None
            return {"devices": [], "error": f"Scan failed (exit code {code})", "hint": hint}
        proc.join(timeout=2)
        return {"devices": msg.get("devices", []), "error": msg.get("error"), "hint": None}

    def connect_direct(self, device_name: str) -> None:
        import multiprocessing as mp

        from app.eeg.direct_worker import run_worker

        self.disconnect_direct()
        ctx = mp.get_context("spawn")
        self._direct_out = ctx.Queue(maxsize=2_000)
        self._direct_cmd = ctx.Queue()
        self._direct_proc = ctx.Process(
            target=run_worker,
            args=(device_name, self._direct_out, self._direct_cmd),
            name="brainaccess-direct",
            daemon=True,
        )
        self.mode = "direct"  # pauses Board listening
        self._switch = True
        self._direct_proc.start()
        self._set_status("connecting", device=device_name)
        threading.Thread(
            target=self._pump_direct, args=(self._direct_proc, self._direct_out), daemon=True
        ).start()

    def disconnect_direct(self) -> None:
        proc = self._direct_proc
        if proc is None:
            return
        with contextlib.suppress(Exception):
            self._direct_cmd.put("stop")
        proc.join(timeout=5)
        if proc.is_alive():
            proc.terminate()
        self._direct_proc = None
        self.mode = "board"
        self.processor.reset()
        self._set_status("waiting")

    def _pump_direct(self, proc: Any, out: Any) -> None:
        """Moves messages from the direct worker process into the common pipeline."""
        while proc.is_alive() or not out.empty():
            try:
                msg = out.get(timeout=0.5)
            except queue.Empty:
                continue
            if msg["type"] == "chunk":
                msg["names"] = self.fallback_names[: msg["eeg"].shape[0]]
                with contextlib.suppress(queue.Full):
                    self._msgs.put_nowait(msg)
            else:
                st = {k: v for k, v in msg.items() if k not in ("type", "state")}
                if msg["state"] == "streaming":
                    st["channel_names"] = self.fallback_names[: st.get("electrodes", 8)]
                    st["stream"] = None
                self._set_status(msg["state"], **st)
        if self._direct_proc is proc:  # died on its own (not via disconnect)
            code = proc.exitcode
            if code not in (0, None):
                self._set_status("error", error=f"Direct connection crashed (exit {code})",
                                 hint=BT_PERMISSION_HINT if code in (134, -6) else None)  # fmt: skip
            self._direct_proc = None
            self.mode = "board"

    # ------------------------------------------------------------------ Board (LSL) reader thread
    _switch = False

    def _set_status(self, state: str, **extra: Any) -> None:
        if state != self.status.get("state"):
            log.info("EEG (Board/LSL): %s %s", state, extra.get("device") or extra.get("error") or "")
        self.status = {"state": state, **extra}

    def _resolve(self) -> Any | None:
        import pylsl

        streams = [
            s
            for s in pylsl.resolve_byprop("type", "EEG", timeout=1.0)
            if _is_brainaccess(s) and (self.allow_remote or _is_local(s))
        ]
        self.available = [
            {
                "name": s.name(),
                "device": s.source_id(),
                "channels": s.channel_count(),
                "sample_rate": s.nominal_srate(),
            }
            for s in streams
        ]
        if not streams:
            return None
        chosen = next((s for s in streams if s.name() == self.preferred), streams[0])
        return chosen

    def _reader(self) -> None:  # noqa: C901 – one linear read loop
        import pylsl

        while not self._stop.is_set():
            if self.mode == "direct":  # direct SDK connection active -> Board listening paused
                self._stop.wait(1.0)
                continue
            info = self._resolve()
            if info is None:
                if self.mode == "board":
                    self._set_status("waiting")
                self._stop.wait(RESOLVE_EVERY_S)
                continue

            inlet = pylsl.StreamInlet(info, max_buflen=30, recover=True)
            full = inlet.info(timeout=5)
            chans = _channels(full)
            idx = {t: [i for i, (_, ct) in enumerate(chans) if ct == t] for t in {ct for _, ct in chans}}
            eeg_i = idx.get("EEG", list(range(min(8, full.channel_count()))))
            labels = [chans[i][0] for i in eeg_i] if chans else self.fallback_names
            contact_i = idx.get("CONTACT", [])
            accel_i = idx.get("ACCEL", [])
            sample_i = (idx.get("SAMPLE") or [None])[0]
            stream_i = next((i for i, (lab, _) in enumerate(chans) if lab.lower() == "streaming"), None)
            battery_i = (idx.get("BATTERY") or [None])[0]
            fs = int(full.nominal_srate()) or 250
            self.processor = SignalProcessor(labels)
            base = {
                "device": full.source_id() or full.name(),
                "stream": full.name(),
                "sample_rate": fs,
                "electrodes": len(eeg_i),
                "has_accel": bool(accel_i),
                "channel_names": labels,
            }
            self._set_status("connected", **base)
            # LSL timestamps are in local_clock() seconds -> wall clock ms
            clock_offset = time.time() - pylsl.local_clock()
            last_sample = time.monotonic()
            self._switch = False

            try:
                while not self._stop.is_set() and not self._switch and self.mode == "board":
                    # Low latency: block only until the FIRST sample arrives, then take everything already
                    # buffered without waiting (pull_chunk with a timeout waits for the whole timeout).
                    first, t_first = inlet.pull_sample(timeout=0.5)
                    chunk, ts = inlet.pull_chunk(timeout=0.0, max_samples=1_000)
                    if first is not None:
                        chunk = [first, *chunk]
                        ts = [t_first, *ts]
                    if not chunk:
                        if time.monotonic() - last_sample > STALL_AFTER_S:
                            self._set_status(
                                "stalled",
                                **base,
                                error="Board stream exists but no data – is the headset streaming?",
                            )
                            # Re-check the network: Board may have closed this stream (headset disconnected)
                            self._resolve()
                            if full.name() not in {x["name"] for x in self.available}:
                                break
                            last_sample = time.monotonic()
                        continue
                    last_sample = time.monotonic()
                    a = np.asarray(chunk, dtype=float).T  # (channels, k)
                    battery = int(a[battery_i, -1]) if battery_i is not None else None
                    self._set_status("streaming", **base, battery=battery)
                    msg = {
                        "type": "chunk",
                        "fs": fs,
                        "names": labels,
                        "t_end_ms": int((ts[-1] + clock_offset) * 1000),
                        "ts_ms": [int((t + clock_offset) * 1000) for t in ts],
                        "eeg": a[eeg_i],
                        "contact": a[contact_i] if contact_i else None,
                        "accel": a[accel_i] if accel_i else None,
                        "sample_number": a[sample_i] if sample_i is not None else None,
                        "streaming": a[stream_i] if stream_i is not None else None,
                    }
                    with contextlib.suppress(queue.Full):
                        self._msgs.put_nowait(msg)
            except Exception as e:  # stream lost (Board closed / headset disconnected)
                if self.mode == "board":
                    self._set_status("waiting", error=f"Stream lost: {e}")
            finally:
                with contextlib.suppress(Exception):
                    inlet.close_stream()
            self.processor.reset()

    # ------------------------------------------------------------------ async loop for the hub
    def _drain(self, timeout: float) -> list[dict]:
        msgs: list[dict] = []
        deadline = time.monotonic() + timeout
        while (left := deadline - time.monotonic()) > 0:
            try:
                msgs.append(self._msgs.get(timeout=left))
            except queue.Empty:
                break
        return msgs

    async def stream(self) -> AsyncIterator[dict]:
        """Yields a snapshot every 250 ms while samples flow; otherwise yields nothing."""
        while True:
            for msg in await asyncio.to_thread(self._drain, T.SNAPSHOT_EVERY_S):
                self.last_data_ms = msg["t_end_ms"]
                self.processor.add_chunk(msg)
                self.recorder.write(msg)
            if self.status.get("state") == "streaming":
                snap = await asyncio.to_thread(self.processor.snapshot, int(time.time() * 1000))
                if snap:
                    snap["source"] = f"brainaccess-{self.mode}"
                    yield snap
