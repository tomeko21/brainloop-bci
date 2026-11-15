"""Raw EEG to <session folder>/eeg_raw.csv on a background thread, one row per sample, joinable by ts_ms."""

from __future__ import annotations

import contextlib
import csv
import queue
import threading
from pathlib import Path

import numpy as np

FILE_NAME = "eeg_raw.csv"


class EegRecorder:
    def __init__(self) -> None:
        self._q: queue.Queue | None = None
        self._thread: threading.Thread | None = None
        self.session_id: str | None = None
        self.path: Path | None = None
        self.samples = 0

    @property
    def active(self) -> bool:
        return self._q is not None

    def start(self, session_id: str, folder: Path, channel_names: list[str]) -> Path:
        self.stop()
        folder.mkdir(parents=True, exist_ok=True)
        self.path = folder / FILE_NAME
        self.session_id = session_id
        self.samples = 0
        self._q = queue.Queue(maxsize=10_000)
        self._thread = threading.Thread(
            target=self._run, args=(self.path, channel_names, self._q), daemon=True
        )
        self._thread.start()
        return self.path

    def write(self, msg: dict) -> None:
        if self._q is not None:
            # disk too slow, drop rather than block the stream
            with contextlib.suppress(queue.Full):
                self._q.put_nowait(msg)

    def stop(self) -> tuple[Path | None, int]:
        if self._q is None:
            return None, 0
        self._q.put(None)
        if self._thread:
            self._thread.join(timeout=5)
        path, n = self.path, self.samples
        self._q = self._thread = None
        self.session_id = None
        return path, n

    def _run(self, path: Path, names: list[str], q: queue.Queue) -> None:
        with path.open("w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            header_written = False
            while (msg := q.get()) is not None:
                eeg: np.ndarray = msg["eeg"]
                n_ch, k = eeg.shape
                names = msg.get("names") or names
                ch_names = names[:n_ch] + [f"E{i}" for i in range(len(names), n_ch)]
                accel = msg.get("accel")
                if not header_written:
                    header = ["ts_ms", "sample_number", "streaming", *(f"{n}_uv" for n in ch_names)]
                    header += [f"{n}_contact" for n in ch_names]
                    if accel is not None:
                        header += ["accel_x_ms2", "accel_y_ms2", "accel_z_ms2"]
                    w.writerow(header)
                    header_written = True
                # Board gives per-sample LSL timestamps, direct mode only the chunk end
                if msg.get("ts_ms") is not None:
                    ts = msg["ts_ms"]
                else:
                    step = 1000.0 / float(msg["fs"])
                    ts = [msg["t_end_ms"] - step * (k - 1 - i) for i in range(k)]
                contact = msg.get("contact")
                sample_no = msg.get("sample_number")
                streaming = msg.get("streaming")
                for i in range(k):
                    row = [
                        int(ts[i]),
                        int(sample_no[i]) if sample_no is not None else "",
                        int(streaming[i]) if streaming is not None else "",
                    ]
                    row += [f"{v:.3f}" for v in eeg[:, i]]
                    row += [int(c) for c in contact[:, i]] if contact is not None else [""] * n_ch
                    if accel is not None:
                        row += [f"{v:.4f}" for v in accel[:, i]]
                    w.writerow(row)
                self.samples += k
