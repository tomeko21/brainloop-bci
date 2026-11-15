"""BrainAccess SDK in a child process (spawned by eeg_source) so a Bluetooth crash can't take the API down."""

from __future__ import annotations

import queue
import time
from dataclasses import dataclass
from typing import Any

import numpy as np

STATUS_EVERY_S = 10.0  # s, battery refresh while streaming
RECONNECT_ATTEMPTS = 3  # retries of the same headset after a drop
RECONNECT_DELAY_S = 3.0


def _status(out: Any, state: str, **extra: Any) -> None:
    out.put({"type": "status", "state": state, **extra})


def _stop_requested(commands: Any) -> bool:
    try:
        return commands.get_nowait() == "stop"
    except queue.Empty:
        return False


@dataclass
class _Rows:
    fs: int
    eeg: list[int]
    contact: list[int]
    accel: list[int]
    sample: int
    streaming: int


def _configure(mgr: Any, ch: Any, gain: Any) -> tuple[_Rows, int, bool]:
    features = mgr.get_device_features()
    n_el = features.electrode_count()
    has_accel = features.has_accel()
    for e in range(n_el):
        mgr.set_channel_enabled(ch.ELECTRODE_MEASUREMENT + e, True)
        mgr.set_channel_gain(ch.ELECTRODE_MEASUREMENT + e, gain.X8)
        mgr.set_channel_enabled(ch.ELECTRODE_CONTACT + e, True)
    # last electrode is the bias
    mgr.set_channel_bias_feedback(ch.ELECTRODE_MEASUREMENT + (n_el - 1))
    if has_accel:
        for axis in range(3):
            mgr.set_channel_enabled(ch.ACCELEROMETER + axis, True)
    mgr.set_channel_enabled(ch.SAMPLE_NUMBER, True)
    mgr.set_channel_enabled(ch.STREAMING, True)
    mgr.load_config()
    idx = mgr.get_channel_index
    rows = _Rows(
        fs=mgr.get_sample_frequency(),
        eeg=[idx(ch.ELECTRODE_MEASUREMENT + e) for e in range(n_el)],
        contact=[idx(ch.ELECTRODE_CONTACT + e) for e in range(n_el)],
        accel=[idx(ch.ACCELEROMETER + a) for a in range(3)] if has_accel else [],
        sample=idx(ch.SAMPLE_NUMBER),
        streaming=idx(ch.STREAMING),
    )
    return rows, n_el, has_accel


def _stream(mgr: Any, target: str, out: Any, commands: Any, sdk: dict[str, Any]) -> bool:
    mgr.connect(target)
    rows, n_el, has_accel = _configure(mgr, sdk["eeg_channel"], sdk["GainMode"])
    disconnected = {"flag": False}

    # runs on the SDK thread, copy and hand over only
    def on_chunk(chunk: list, _size: int) -> None:
        out.put(
            {
                "type": "chunk",
                "fs": rows.fs,
                "t_end_ms": int(time.time() * 1000),
                "eeg": np.vstack([chunk[r] for r in rows.eeg]),
                "contact": np.vstack([chunk[r] for r in rows.contact]),
                "accel": np.vstack([chunk[r] for r in rows.accel]) if rows.accel else None,
                "sample_number": chunk[rows.sample],
                "streaming": chunk[rows.streaming],
            }
        )

    def on_disconnect(*_: Any) -> None:
        disconnected["flag"] = True

    mgr.set_callback_chunk(on_chunk)
    mgr.set_callback_disconnect(on_disconnect)
    mgr.start_stream()
    base = {"device": target, "electrodes": n_el, "has_accel": has_accel, "sample_rate": rows.fs}
    _status(out, "streaming", **base, battery=mgr.get_battery_info().level)

    last_status = time.time()
    while not disconnected["flag"]:
        if _stop_requested(commands):
            mgr.stop_stream()
            return True
        if time.time() - last_status > STATUS_EVERY_S:
            last_status = time.time()
            _status(out, "streaming", **base, battery=mgr.get_battery_info().level)
        time.sleep(0.2)
    return False


def run_scan(out: Any) -> None:
    try:
        from brainaccess import core
    except Exception as e:
        out.put({"type": "scan", "devices": [], "error": f"BrainAccess SDK unavailable: {e}"})
        return
    core.init()
    try:
        out.put({"type": "scan", "devices": [d.name for d in core.scan()]})
    except Exception as e:
        out.put({"type": "scan", "devices": [], "error": str(e)})
    finally:
        core.close()


def run_worker(device_name: str, out: Any, commands: Any) -> None:
    try:
        from brainaccess import core
        from brainaccess.core import eeg_channel
        from brainaccess.core.eeg_manager import EEGManager
        from brainaccess.core.gain_mode import GainMode
    except Exception as e:
        _status(out, "error", error=f"BrainAccess SDK unavailable: {e}")
        return

    sdk = {"eeg_channel": eeg_channel, "GainMode": GainMode}
    core.init()
    try:
        for attempt in range(1 + RECONNECT_ATTEMPTS):
            if _stop_requested(commands):
                return
            _status(out, "connecting", device=device_name, attempt=attempt + 1)
            try:
                # the SDK only connects to a headset found by a scan in this same process (CoreBluetooth)
                names = [d.name for d in core.scan()]
                if device_name not in names:
                    seen = ", ".join(names) or "none"
                    msg = f"{device_name} not found (seen: {seen}). Is it on and free in Board?"
                    _status(out, "error", device=device_name, error=msg)
                    time.sleep(RECONNECT_DELAY_S)
                    continue
                with EEGManager() as mgr:
                    if _stream(mgr, device_name, out, commands, sdk):
                        return
            except Exception as e:
                _status(out, "error", device=device_name, error=str(e))
            time.sleep(RECONNECT_DELAY_S)
        _status(out, "disconnected", device=device_name, error="Connection lost – connect again in the app")
    finally:
        core.close()
