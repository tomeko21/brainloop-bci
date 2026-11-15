"""Live BRI from EEG chunks + browser face frames, with data_acc's feature code and the exported model."""

from __future__ import annotations

import logging
import sys
import threading
import time
from collections import deque
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import numpy as np

from app.brainrot import tuning as T

log = logging.getLogger(__name__)

EPS = 1e-9


# landmarks data_acc face_tracker.face_features reads, the browser sends only these
# fmt: off
FACE_LANDMARKS = [
    33, 160, 158, 133, 153, 144, 362, 385, 387, 263, 373, 380,
    468, 473, 159, 145, 386, 374, 1, 152, 10,
]
# fmt: on


# 478-point MediaPipe-like list, points not sent are NaN (never read)
def _landmarks(pts: dict[str, list[float]]) -> list[SimpleNamespace]:
    lm = [SimpleNamespace(x=np.nan, y=np.nan) for _ in range(478)]
    for k, v in pts.items():
        lm[int(k)] = SimpleNamespace(x=float(v[0]), y=float(v[1]))
    return lm


class BriSmoother:
    def __init__(self) -> None:
        self.hist: deque[tuple[float, float]] = deque()
        self.bri: float | None = None
        self.last_input_t: float | None = None

    def reset(self) -> None:
        self.hist.clear()
        self.bri = None
        self.last_input_t = None

    def update(self, t: float, raw: float | None) -> tuple[float | None, bool]:
        if raw is not None and np.isfinite(raw):
            self.hist.append((t, float(raw)))
            self.last_input_t = t
        while self.hist and self.hist[0][0] < t - T.SLOW_MEDIAN_S:
            self.hist.popleft()
        if self.last_input_t is None:
            return None, False
        idle = t - self.last_input_t
        if idle > T.DROP_AFTER_S:
            self.reset()
            return None, False
        if raw is None or not self.hist:
            # no new data: hold the value, never fall to 0
            return self.bri, idle > T.HOLD_S
        fast = float(np.median([v for (ts, v) in self.hist if ts >= t - T.FAST_MEDIAN_S]))
        slow = float(np.median([v for (_, v) in self.hist]))
        target = max(fast, slow)
        if self.bri is None:
            self.bri = target
            return self.bri, False
        up = target > self.bri
        a = 1 - np.exp(-T.TICK_S / (T.TAU_UP_S if up else T.TAU_DOWN_S))
        step = a * (target - self.bri)
        lim = (T.MAX_UP_PER_S if up else T.MAX_DOWN_PER_S) * T.TICK_S
        self.bri = float(np.clip(self.bri + np.clip(step, -lim, lim), 0, 100))
        return self.bri, False


class LiveBrainRot:
    def __init__(self, model_path: Path, data_acc_dir: Path) -> None:
        self.enabled = False
        self.error: str | None = None
        self._lock = threading.Lock()
        self._eeg: deque[dict] = deque()
        self._face: deque[dict] = deque()
        self._clock_lat: deque[tuple[float, float]] = deque()
        self.smoother = BriSmoother()
        self.latest: dict[str, Any] = {"tMs": 0, "bri": None, "enabled": False}
        self.baseline: dict[str, dict[str, float]] = {}
        self.baseline_mode = "default"  # default (training people) | collecting | personal
        self._baseline_start: float | None = None
        self._baseline_windows: list[dict[str, float]] = []
        try:
            # the same functions that built the training data (process.build_synced, eeg_window, face_window)
            if str(data_acc_dir) not in sys.path:
                sys.path.insert(0, str(data_acc_dir))
            import analyze as DA
            import config as DC
            import face_tracker as DF
            import joblib
            import process as DP

            self.DA, self.DC, self.DF, self.DP = DA, DC, DF, DP
            self.bundle = joblib.load(model_path)
            self.model = self.bundle["model"]
            self.features: list[str] = self.bundle["features"]
            self.log_features = set(self.bundle["log_features"])
            self.default_baseline = self.bundle["default_baseline"]
            self.baseline = dict(self.default_baseline)
            self.enabled = True
            log.info("Live BRI model loaded: %s (%d features)", self.bundle.get("config"), len(self.features))
        except Exception as e:
            # missing model or data_acc, the app keeps running without the live BRI
            self.error = f"{type(e).__name__}: {e}"
            log.warning("Live BRI disabled: %s", self.error)

    def add_eeg(self, msg: dict) -> None:
        if not self.enabled:
            return
        eeg = np.asarray(msg["eeg"], dtype=float)
        k = eeg.shape[1]
        fs = float(msg.get("fs") or 250)
        ts = msg.get("ts_ms")
        ts = (
            np.asarray(ts, float)
            if ts is not None and len(ts) == k
            else (float(msg["t_end_ms"]) - np.arange(k)[::-1] * 1000.0 / fs)
        )
        chunk = {
            "ts": ts,
            "eeg": eeg,
            "names": list(msg.get("names") or []),
            "contact": None if msg.get("contact") is None else np.asarray(msg["contact"], float),
            "accel": None if msg.get("accel") is None else np.asarray(msg["accel"], float),
        }
        with self._lock:
            self._eeg.append(chunk)
            self._trim(self._eeg, lambda c: c["ts"][-1])

    # brainrotClient.ts frames: {ts, present, lm: {idx: [x, y]}, bs: {name: score}, m: 4x4 col-major, w, h}
    def add_face_frames(self, frames: list[dict]) -> int:
        if not self.enabled or not frames:
            return 0
        offset = self._clock_offset(frames)
        rows = []
        for f in frames:
            try:
                row: dict[str, Any] = {
                    "ts_ms": float(f["ts"]) + offset,
                    "face_present": int(bool(f.get("present"))),
                }
                if row["face_present"]:
                    bs = {str(k): float(v) for k, v in (f.get("bs") or {}).items()}
                    m = f.get("m")
                    mat = np.asarray(m, float).reshape(4, 4).T if m is not None and len(m) == 16 else None
                    row.update(self.DF.face_features(_landmarks(f["lm"]), bs, mat, int(f["w"]), int(f["h"])))
                    row.update({f"bs_{k}": v for k, v in bs.items()})
                rows.append(row)
            except Exception as e:
                log.debug("bad face frame: %s", e)
        self.add_face_rows(rows)
        return len(rows)

    def _clock_offset(self, frames: list[dict]) -> float:
        """Server minus device clock: min (receive time minus newest frame ts) over CLOCK_WINDOW_S."""
        now = time.time() * 1000
        try:
            newest = max(float(f["ts"]) for f in frames)
        except (KeyError, TypeError, ValueError):
            return 0.0
        with self._lock:
            self._clock_lat.append((now, now - newest))
            while self._clock_lat and self._clock_lat[0][0] < now - T.CLOCK_WINDOW_S * 1000:
                self._clock_lat.popleft()
            return min(lat for _, lat in self._clock_lat)

    def add_face_rows(self, rows: list[dict]) -> None:
        """Already derived rows (data_acc face.csv columns), used by replay tests."""
        if not self.enabled or not rows:
            return
        with self._lock:
            self._face.extend(rows)
            self._trim(self._face, lambda r: r["ts_ms"])

    @staticmethod
    def _trim(buf: deque, last_ts) -> None:  # noqa: ANN001
        if not buf:
            return
        newest = last_ts(buf[-1])
        while len(buf) > 1 and last_ts(buf[0]) < newest - T.BUFFER_S * 1000:
            buf.popleft()

    def start_baseline(self, now_ms: float | None = None) -> dict:
        self._baseline_start = now_ms if now_ms is not None else time.time() * 1000
        self._baseline_windows = []
        self.baseline_mode = "collecting"
        self.smoother.reset()
        return {"ok": True, "mode": self.baseline_mode}

    def finish_baseline(self) -> dict:
        wins = self._baseline_windows
        self._baseline_start = None
        if len(wins) < T.BASELINE_MIN_WINDOWS:
            self.baseline_mode = "personal" if self.baseline_mode == "personal" else "default"
            return {"ok": False, "windows": len(wins), "features": 0, "mode": self.baseline_mode}
        base = {}
        for f in self.features:
            v = np.array(
                [self._t(f, w[f]) for w in wins if f in w and w[f] is not None and np.isfinite(w[f])]
            )
            if len(v) < 5:
                continue
            floor = T.STD_FLOOR_OF_DEFAULT * self.default_baseline.get(f, {}).get("std", 0.0)
            base[f] = {"mean": float(v.mean()), "std": float(max(v.std(ddof=1), floor, EPS))}
        self.baseline = {**self.default_baseline, **base}
        self.baseline_mode = "personal"
        self.smoother.reset()
        return {"ok": True, "windows": len(wins), "features": len(base), "mode": self.baseline_mode}

    def _t(self, f: str, v: float) -> float:
        return float(np.log(max(v, 1e-6))) if f in self.log_features else float(v)

    def _frames(self) -> tuple[Any, Any]:
        import pandas as pd

        with self._lock:
            eeg = list(self._eeg)
            face = list(self._face)
        eeg_df = face_df = None
        if eeg:
            names = next((c["names"] for c in eeg if c["names"]), None) or self.DC.EEG_CHANNEL_NAMES
            n = eeg[-1]["eeg"].shape[0]
            names = (list(names) + [f"E{i}" for i in range(n)])[:n]
            cols: dict[str, Any] = {"ts_ms": np.concatenate([c["ts"] for c in eeg])}
            data = np.concatenate([c["eeg"] for c in eeg if c["eeg"].shape[0] == n], axis=1)
            if data.shape[1] == len(cols["ts_ms"]):
                for i, ch in enumerate(names):
                    cols[f"{ch}_uv"] = data[i]
                if all(c["contact"] is not None for c in eeg):
                    con = np.concatenate([c["contact"] for c in eeg], axis=1)
                    for i, ch in enumerate(names):
                        cols[f"{ch}_contact"] = (con[i] >= 0.5).astype(float)
                if all(c["accel"] is not None for c in eeg):
                    acc = np.concatenate([c["accel"] for c in eeg], axis=1)
                    for i, ax in enumerate(("accel_x", "accel_y", "accel_z")):
                        cols[ax] = acc[i]
                eeg_df = (
                    pd.DataFrame(cols).sort_values("ts_ms").drop_duplicates("ts_ms").reset_index(drop=True)
                )
        if face:
            face_df = pd.DataFrame(face).sort_values("ts_ms").reset_index(drop=True)
            face_df["face_present"] = face_df["face_present"].fillna(0)
        return eeg_df, face_df

    def compute_features(self, now_ms: float) -> tuple[dict[str, float] | None, dict]:
        DP, DC = self.DP, self.DC
        eeg_df, face_df = self._frames()
        fresh = lambda d: d is not None and len(d) > 2 and d["ts_ms"].iloc[-1] > now_ms - 3000  # noqa: E731
        eeg_df = eeg_df if fresh(eeg_df) else None
        face_df = face_df if fresh(face_df) else None
        info: dict[str, Any] = {"eeg": eeg_df is not None, "face": face_df is not None}
        if eeg_df is None and face_df is None:
            return None, info
        synced, channels = DP.build_synced(eeg_df, face_df, [])
        fs = DC.SYNC_HZ
        # window must sit inside filtered signal and inside data both sources have delivered
        end = min(now_ms - T.WINDOW_LAG_S * 1000, float(synced["ts_ms"].iloc[-1]))
        seg = synced[(synced["ts_ms"] > end - DC.WINDOW_S * 1000) & (synced["ts_ms"] <= end)]
        if len(seg) < 0.8 * DC.WINDOW_S * fs:
            return None, info
        f: dict[str, Any] = {}
        eeg_clean = False
        if channels:
            f.update(DP.eeg_window(seg, channels, fs))
            if "accel_g" in seg:
                f["motion_g"] = float(np.nanstd(seg["accel_g"]))
            eeg_clean = (
                f.get("eeg_n_good", 0) >= DC.MIN_GOOD_CHANNELS and f.get("motion_g", 0.0) < DC.ACCEL_MOTION_G
            )
        face_clean = False
        if "face_present" in seg:
            f.update(DP.face_window(seg, fs))
            face_clean = f.get("face_present_ratio", 0.0) >= 0.8
        out = {}
        # per-modality cleaning like data_acc analyze.load_session, the model handles NaN
        for k in self.features:
            ok = eeg_clean if self.DA.is_eeg(k) else face_clean
            v = f.get(k)
            out[k] = float(v) if ok and v is not None and np.isfinite(v) else np.nan
        info.update(eeg_clean=eeg_clean, face_clean=face_clean, eeg_good_channels=int(f.get("eeg_n_good", 0)))
        return out, info

    def tick(self, now_ms: float | None = None) -> dict:
        now_ms = now_ms if now_ms is not None else time.time() * 1000
        state: dict[str, Any] = {"tMs": int(now_ms), "enabled": self.enabled, "error": self.error}
        if not self.enabled:
            self.latest = {**state, "bri": None}
            return self.latest
        raw = p = None
        try:
            feats, info = self.compute_features(now_ms)
        except Exception as e:
            log.exception("live feature computation failed")
            feats, info = None, {"error": str(e)}
        if feats is not None:
            if (
                self.baseline_mode == "collecting"
                and self._baseline_start is not None
                and (now_ms - self._baseline_start >= self.bundle["skip_baseline_s"] * 1000)
            ):
                self._baseline_windows.append(feats)
            usable = sum(np.isfinite(v) for v in feats.values())
            if usable >= 0.3 * len(self.features):
                # z-score against this person's baseline, or the training-people default
                z = {}
                for k, v in feats.items():
                    b = self.baseline.get(k)
                    z[k] = (
                        np.clip(
                            (self._t(k, v) - b["mean"]) / b["std"],
                            -self.bundle["z_clip"],
                            self.bundle["z_clip"],
                        )
                        if b and np.isfinite(v)
                        else np.nan
                    )
                import pandas as pd

                X = pd.DataFrame([z], columns=self.features)
                p = float(self.model.predict_proba(X)[0, 1])
                # calibrated so the baseline sits near 25 and typical Instagram scrolling near 75
                cal, pc = self.bundle["calibration"], self.bundle["p_clip"]
                q = min(max(p, pc), 1 - pc)
                lg = np.log(q / (1 - q))
                raw = float(np.clip(100 / (1 + np.exp(-(lg - cal["s_mid"]) / cal["s_scale"])), 0, 100))
        collecting = self.baseline_mode == "collecting"
        # no BRI while the baseline is being collected
        bri, stale = self.smoother.update(now_ms / 1000, None if collecting else raw)
        elapsed = (now_ms - self._baseline_start) / 1000 if self._baseline_start else None
        state.update(
            bri=None if collecting or bri is None else round(bri, 1),
            briRaw=None if raw is None else round(raw, 1),
            pBrainrot=None if p is None else round(p, 4),
            stale=stale,
            baselineMode=self.baseline_mode,
            baselineElapsedS=None if elapsed is None else round(elapsed, 1),
            baselineWindows=len(self._baseline_windows),
            sources={
                "eeg": bool(info.get("eeg_clean")),
                "face": bool(info.get("face_clean")),
                "eegConnected": bool(info.get("eeg")),
                "faceConnected": bool(info.get("face")),
            },
            eegGoodChannels=info.get("eeg_good_channels", 0),
            model=self.bundle.get("config"),
        )
        self.latest = state
        return state
