# headset input, direct SDK or LSL from BrainAccess Board (same two modes as backend/app/eeg)
# writes eeg_raw.csv with epoch ms timestamps and provides live contact quality for main.py
from __future__ import annotations

import contextlib
import csv
import multiprocessing as mp
import queue
import threading
import time
from pathlib import Path
from typing import Any

import numpy as np
from scipy.signal import butter, iirnotch, sosfiltfilt, tf2sos

import config as C


# runs in a spawned child, so if macOS kills it over Bluetooth permission only the child dies
def _sdk_worker(device_name: str, out: Any, commands: Any) -> None:  # noqa: C901
    try:
        from brainaccess import core
        from brainaccess.core import eeg_channel as ch
        from brainaccess.core.eeg_manager import EEGManager
        from brainaccess.core.gain_mode import GainMode
    except Exception as e:
        out.put({"type": "status", "state": "error", "error": f"BrainAccess SDK unavailable: {e}"})
        return

    core.init()
    try:
        out.put({"type": "status", "state": "scanning"})
        names = [d.name for d in core.scan()]
        target = device_name or next((n for n in names if n), "")
        if not target or target not in names:
            out.put(
                {
                    "type": "status",
                    "state": "error",
                    "error": f"Headset '{device_name}' not found. Seen: {names or 'none'}",
                }
            )
            return
        out.put({"type": "status", "state": "connecting", "device": target})
        with EEGManager() as mgr:
            mgr.connect(target)
            features = mgr.get_device_features()
            n_el = features.electrode_count()
            has_accel = features.has_accel()
            for e in range(n_el):
                mgr.set_channel_enabled(ch.ELECTRODE_MEASUREMENT + e, True)
                mgr.set_channel_gain(ch.ELECTRODE_MEASUREMENT + e, GainMode.X8)
                mgr.set_channel_enabled(ch.ELECTRODE_CONTACT + e, True)
            mgr.set_channel_bias_feedback(ch.ELECTRODE_MEASUREMENT + (n_el - 1))
            if has_accel:
                for axis in range(3):
                    mgr.set_channel_enabled(ch.ACCELEROMETER + axis, True)
            mgr.set_channel_enabled(ch.SAMPLE_NUMBER, True)
            mgr.set_channel_enabled(ch.STREAMING, True)
            mgr.load_config()
            idx = mgr.get_channel_index
            fs = mgr.get_sample_frequency()
            r_eeg = [idx(ch.ELECTRODE_MEASUREMENT + e) for e in range(n_el)]
            r_con = [idx(ch.ELECTRODE_CONTACT + e) for e in range(n_el)]
            r_acc = [idx(ch.ACCELEROMETER + a) for a in range(3)] if has_accel else []
            r_sn, r_st = idx(ch.SAMPLE_NUMBER), idx(ch.STREAMING)
            gone = {"flag": False}

            def on_chunk(chunk: list, _size: int) -> None:
                t_end = time.time() * 1000.0
                n = len(chunk[r_sn])
                out.put(
                    {
                        "type": "chunk",
                        "fs": fs,
                        # chunk arrival time is its last sample, earlier ones are back-dated by 1/fs,
                        # process.py refines this later
                        "ts_ms": t_end - (np.arange(n)[::-1] * 1000.0 / fs),
                        "eeg": np.vstack([chunk[r] for r in r_eeg]),
                        "contact": np.vstack([chunk[r] for r in r_con]),
                        "accel": np.vstack([chunk[r] for r in r_acc]) if r_acc else None,
                        "sample_number": np.asarray(chunk[r_sn]),
                        "streaming": np.asarray(chunk[r_st]),
                    }
                )

            mgr.set_callback_chunk(on_chunk)
            mgr.set_callback_disconnect(lambda *_: gone.__setitem__("flag", True))
            mgr.start_stream()
            out.put(
                {
                    "type": "status",
                    "state": "streaming",
                    "device": target,
                    "fs": fs,
                    "electrodes": n_el,
                    "battery": mgr.get_battery_info().level,
                }
            )
            while not gone["flag"]:
                with contextlib.suppress(queue.Empty):
                    if commands.get_nowait() == "stop":
                        mgr.stop_stream()
                        break
                time.sleep(0.1)
            if gone["flag"]:
                out.put({"type": "status", "state": "error", "error": "Headset disconnected"})
    except Exception as e:
        out.put({"type": "status", "state": "error", "error": str(e)})
    finally:
        core.close()


class EegDevice:
    def __init__(self, mode: str = C.EEG_MODE, device: str = C.EEG_DEVICE) -> None:
        self.mode = mode
        self.device = device
        self.names = list(C.EEG_CHANNEL_NAMES)
        self.fs = 250
        self.status: dict[str, Any] = {"state": "idle"}
        self._lock = threading.Lock()
        self._ring: np.ndarray | None = None
        self._contact: np.ndarray | None = None
        self._last_sample_t = 0.0
        self._writer_q: queue.Queue | None = None
        self._writer_t: threading.Thread | None = None
        self.samples_written = 0
        self._stop = threading.Event()
        self._proc: Any = None
        self._cmd: Any = None

    def start(self) -> None:
        if self.mode == "direct":
            ctx = mp.get_context("spawn")
            out = ctx.Queue(maxsize=5_000)
            self._cmd = ctx.Queue()
            self._proc = ctx.Process(target=_sdk_worker, args=(self.device, out, self._cmd), daemon=True)
            self._proc.start()
            threading.Thread(target=self._pump, args=(out,), daemon=True).start()
        elif self.mode == "board":
            threading.Thread(target=self._lsl_reader, daemon=True).start()
        else:
            raise ValueError(f"unknown EEG mode {self.mode!r}")

    def stop(self) -> None:
        self._stop.set()
        self.stop_recording()
        if self._proc is not None:
            with contextlib.suppress(Exception):
                self._cmd.put("stop")
            self._proc.join(timeout=5)
            if self._proc.is_alive():
                self._proc.terminate()

    def start_recording(self, path: Path) -> None:
        self._writer_q = queue.Queue()
        self._writer_t = threading.Thread(target=self._writer, args=(path, self._writer_q), daemon=True)
        self._writer_t.start()

    def stop_recording(self) -> None:
        if self._writer_q is not None:
            self._writer_q.put(None)
            if self._writer_t:
                self._writer_t.join(timeout=10)
            self._writer_q = None

    def _writer(self, path: Path, q: queue.Queue) -> None:
        with path.open("w", newline="") as f:
            w = csv.writer(f)
            n = len(self.names)
            w.writerow(
                [
                    "ts_ms",
                    "sample_number",
                    "streaming",
                    *[f"{c}_uv" for c in self.names[:n]],
                    *[f"{c}_contact" for c in self.names[:n]],
                    "accel_x",
                    "accel_y",
                    "accel_z",
                ]
            )
            while (msg := q.get()) is not None:
                eeg, con, acc = msg["eeg"], msg["contact"], msg["accel"]
                k = eeg.shape[1]
                for i in range(k):
                    row = [
                        f"{msg['ts_ms'][i]:.1f}",
                        int(msg["sample_number"][i]) if msg["sample_number"] is not None else "",
                        int(msg["streaming"][i]) if msg["streaming"] is not None else 1,
                        *[f"{v:.3f}" for v in eeg[:, i]],
                        *([int(v >= 0.5) for v in con[:, i]] if con is not None else [1] * eeg.shape[0]),
                        *([f"{v:.4f}" for v in acc[:, i]] if acc is not None else ["", "", ""]),
                    ]
                    w.writerow(row)
                self.samples_written += k

    def _on_chunk(self, msg: dict) -> None:
        eeg = np.asarray(msg["eeg"], dtype=float)
        self.fs = int(msg["fs"])
        with self._lock:
            n_ring = self.fs * 2  # 2 s ring buffer for the contact check
            if self._ring is None or self._ring.shape[0] != eeg.shape[0]:
                self._ring = np.full((eeg.shape[0], n_ring), np.nan)
                self.names = (C.EEG_CHANNEL_NAMES + [f"E{i}" for i in range(20)])[: eeg.shape[0]]
            k = min(eeg.shape[1], n_ring)
            self._ring = np.roll(self._ring, -k, axis=1)
            self._ring[:, -k:] = eeg[:, -k:]
            if msg.get("contact") is not None:
                self._contact = np.asarray(msg["contact"])[:, -1]
            self._last_sample_t = time.time()
        if self._writer_q is not None:
            self._writer_q.put(msg)

    def _pump(self, out: Any) -> None:
        while not self._stop.is_set():
            try:
                msg = out.get(timeout=0.5)
            except queue.Empty:
                if self._proc is not None and not self._proc.is_alive() and self.status["state"] != "error":
                    self.status = {
                        "state": "error",
                        "error": f"SDK process died (exit {self._proc.exitcode})"
                        " – on macOS allow Bluetooth for your terminal",
                    }
                continue
            if msg["type"] == "chunk":
                self._on_chunk(msg)
            else:
                self.status = {k: v for k, v in msg.items() if k != "type"}

    def _lsl_reader(self) -> None:
        import pylsl

        while not self._stop.is_set():
            self.status = {"state": "scanning", "info": "waiting for BrainAccess Board LSL stream"}
            streams = [
                s
                for s in pylsl.resolve_byprop("type", "EEG", timeout=2.0)
                if "brainaccess" in s.name().lower() and (not self.device or self.device in s.name())
            ]
            if not streams:
                continue
            inlet = pylsl.StreamInlet(streams[0], max_buflen=30, recover=True)
            info = inlet.info(timeout=5)
            chans, c = [], info.desc().child("channels").child("channel")
            while not c.empty():
                chans.append((c.child_value("label"), c.child_value("type").upper()))
                c = c.next_sibling()
            by = {t: [i for i, (_, ct) in enumerate(chans) if ct == t] for t in {ct for _, ct in chans}}
            eeg_i = by.get("EEG", list(range(8)))
            con_i, acc_i = by.get("CONTACT", []), by.get("ACCEL", [])
            sn_i = (by.get("SAMPLE") or [None])[0]
            st_i = next((i for i, (lab, _) in enumerate(chans) if lab.lower() == "streaming"), None)
            fs = int(info.nominal_srate()) or 250
            offset = time.time() - pylsl.local_clock()  # LSL clock to epoch, same clock as the camera
            labels = [chans[i][0] for i in eeg_i] if chans else C.EEG_CHANNEL_NAMES
            self.names = labels
            self.status = {"state": "streaming", "device": info.name(), "fs": fs, "electrodes": len(eeg_i)}
            try:
                while not self._stop.is_set():
                    chunk, ts = inlet.pull_chunk(timeout=0.2, max_samples=1_000)
                    if not chunk:
                        continue
                    a = np.asarray(chunk, dtype=float).T
                    self._on_chunk(
                        {
                            "fs": fs,
                            "ts_ms": (np.asarray(ts) + offset) * 1000.0,
                            "eeg": a[eeg_i],
                            "contact": a[con_i] if con_i else None,
                            "accel": a[acc_i] if acc_i else None,
                            "sample_number": a[sn_i] if sn_i is not None else None,
                            "streaming": a[st_i] if st_i is not None else None,
                        }
                    )
            except Exception as e:
                self.status = {"state": "error", "error": f"LSL stream lost: {e}"}

    # per electrode good / poor / flat / nodata, drives the red/green dots on the setup screen
    def contact_quality(self) -> dict[str, str]:
        with self._lock:
            if self._ring is None or time.time() - self._last_sample_t > 2.0:
                return {n: "nodata" for n in self.names}
            x = self._ring.copy()
            contact = None if self._contact is None else self._contact.copy()
        fs = self.fs
        if np.isnan(x).any():
            return {n: "nodata" for n in self.names}
        clipped = (np.abs(x) >= 0.99 * C.RAIL_UV).mean(axis=1)
        y = bandpass_notch(x - x.mean(axis=1, keepdims=True), fs)
        ptp = np.ptp(y[:, -int(fs * C.PTP_WINDOW_S) :], axis=1)
        out: dict[str, str] = {}
        for i, name in enumerate(self.names[: x.shape[0]]):
            if clipped[i] > C.SATURATED_FRACTION:
                out[name] = "poor"
            elif ptp[i] < C.PTP_FLAT_UV:
                out[name] = "flat"
            elif (contact is not None and contact[i] < 0.5) or ptp[i] > C.PTP_MAX_GOOD_UV:
                out[name] = "poor"
            else:
                out[name] = "good"
        return out

    def ptp_uv(self) -> dict[str, float]:
        with self._lock:
            if self._ring is None or np.isnan(self._ring).any():
                return {}
            x = self._ring.copy()
        y = bandpass_notch(x - x.mean(axis=1, keepdims=True), self.fs)
        p = np.ptp(y[:, -int(self.fs * C.PTP_WINDOW_S) :], axis=1)
        return {n: float(p[i]) for i, n in enumerate(self.names[: x.shape[0]])}


def bandpass_notch(x: np.ndarray, fs: float) -> np.ndarray:
    sos = butter(4, C.BANDPASS_HZ, btype="bandpass", fs=fs, output="sos")
    y = sosfiltfilt(sos, x, axis=-1)
    if fs / 2 > C.NOTCH_HZ:
        b, a = iirnotch(C.NOTCH_HZ, 30.0, fs)
        y = sosfiltfilt(tf2sos(b, a), y, axis=-1)
    return y
