"""Turns raw BrainAccess chunks into the snapshot format the frontend expects. REAL signal processing.

THIS IS WHERE THE EEG INDICATORS ARE COMPUTED (every 100 ms, over the last 1.5 s):
  1. per electrode: band-pass 1–40 Hz + 50 Hz notch -> PTP µV, contact quality (good / poor / none),
  2. blink / spike rejection: a channel whose window contains a huge short deflection is left out,
  3. relative theta / alpha / beta power (Welch, within 4–30 Hz) on the remaining good electrodes,
  4. band powers averaged over time (τ 2 s) -> fatigue ratio R = (theta + alpha) / beta
     (EEG fatigue index, Jap et al. 2009; the inverse of the
     "engagement index" beta / (alpha + theta), Pope et al. 1995),
  5. BRI = R relative to THIS person's resting baseline (30 s fixation cross), log scale:
        x   = log(R / R_baseline) / log(4)
        BRI = 25 + 75·x  (x ≥ 0)   |   25 + 25·x  (x < 0)      clipped to 0..100
     -> 25 = like at rest, 100 = ratio 4× the resting one, 0 = ratio 4× lower (much more alert than at rest),
  6. smoothing (no sudden jumps): 3 s rolling median -> exponential smoothing (τ 2 s) -> max 5 pts/s.
The mapping in step 5 (25 / 4× / log) is OUR design choice, not a published scale – see TODO.md §3.
Constants: app/eeg/tuning.py.
"""

from __future__ import annotations

import threading
from collections import deque

import numpy as np
from scipy.signal import butter, filtfilt, iirnotch, sosfiltfilt, welch

from app.eeg import tuning as T


def _band(freqs: np.ndarray, psd: np.ndarray, lo_hi: tuple[float, float]) -> float:
    lo, hi = lo_hi
    m = (freqs >= lo) & (freqs < hi)
    return float(np.trapezoid(psd[m], freqs[m])) if m.any() else 0.0


class SignalProcessor:
    def __init__(self, channel_names: list[str]) -> None:
        self.names = channel_names
        self._lock = threading.Lock()
        self._fs: int | None = None
        self._buf: np.ndarray | None = None  # (n_channels, ring)
        self._filled = 0
        self._new = 0  # samples received since the last snapshot (for the raw wave preview)
        self._contact: np.ndarray | None = None  # last contact flags per channel
        self._accel: np.ndarray | None = None  # last accel mean (m/s²)
        # BRI state
        self._bands_avg: np.ndarray | None = None  # time-averaged (theta, alpha, beta) for the ratio
        self._raw_hist: deque[float] = deque(maxlen=max(1, round(T.BRI_MEDIAN_S / T.SNAPSHOT_EVERY_S)))
        self._bri: float | None = None
        self._stop = False
        self._unreliable = 0  # consecutive snapshots without a reliable EEG window
        # Baseline: "auto" = first BASELINE_SECONDS of clean signal; "fixation" = while the cross is shown
        self._baseline_mode = "auto"
        self._baseline_ratios: list[float] = []
        self._baseline: float | None = None

    # ------------------------------------------------------------------ baseline
    def reset_baseline(self) -> None:
        """New person / new session -> calibrate again (auto mode until a fixation cross starts)."""
        self._baseline_mode = "auto"
        self._baseline_ratios = []
        self._baseline = None
        self._bri = None
        self._raw_hist.clear()

    def start_fixation(self) -> None:
        """Fixation cross is on screen: collect the resting reference from now on."""
        self.reset_baseline()
        self._baseline_mode = "fixation"

    def finish_fixation(self) -> dict:
        """Cross finished: baseline = median ratio of the clean windows collected while it was shown."""
        clean_s = len(self._baseline_ratios) * T.SNAPSHOT_EVERY_S
        if self._baseline_mode == "fixation" and clean_s >= T.BASELINE_MIN_CLEAN_S:
            self._baseline = float(np.median(self._baseline_ratios))
            ok = True
        else:  # too little clean signal (artifacts / headset off) -> keep calibrating automatically
            ok = False
        self._baseline_mode = "auto"
        return {"ok": ok, "cleanSeconds": round(clean_s, 1), "baselineRatio": self._baseline}

    def _fatigue(self, ratio: float) -> float | None:
        """0..1 relative to the per-person baseline; None while calibrating."""
        if self._baseline is None:
            self._baseline_ratios.append(ratio)
            if self._baseline_mode == "fixation":
                return None  # wait for finish_fixation()
            if len(self._baseline_ratios) < T.BASELINE_SECONDS / T.SNAPSHOT_EVERY_S:
                return None
            self._baseline = float(np.median(self._baseline_ratios))
        # rel: 0 at baseline, +1 at ×RATIO_FOR_FULL, −1 at ÷RATIO_FOR_FULL (log scale, symmetric in ratio)
        rel = np.log(ratio / self._baseline) / np.log(T.RATIO_FOR_FULL)
        base = T.BASELINE_BRI / 100
        # above rest: 25 -> 100 over ×4; below rest (more alert): 25 -> 0 over ÷4
        return float(np.clip(base + rel * ((1 - base) if rel >= 0 else base), 0, 1))

    def _smooth(self, fatigue: float) -> float:
        """Raw fatigue (0..1) -> smoothed BRI (0..100): rolling median, EMA, slew-rate limit."""
        self._raw_hist.append(fatigue * 100)
        target = float(np.median(self._raw_hist))
        if self._bri is None:
            return target
        a = 1 - np.exp(-T.SNAPSHOT_EVERY_S / T.BRI_TAU_S)
        ema = self._bri + a * (target - self._bri)
        max_step = T.BRI_MAX_RATE_PER_S * T.SNAPSHOT_EVERY_S
        return float(self._bri + np.clip(ema - self._bri, -max_step, max_step))

    # ------------------------------------------------------------------ input
    def reset(self) -> None:
        with self._lock:
            self._buf = None
            self._filled = 0
            self._new = 0
            self._bri = None
            self._raw_hist.clear()
            self._bands_avg = None

    def add_chunk(self, msg: dict) -> None:
        eeg: np.ndarray = msg["eeg"]
        fs = int(msg["fs"])
        with self._lock:
            if self._buf is None or self._fs != fs or self._buf.shape[0] != eeg.shape[0]:
                self._fs = fs
                self._buf = np.zeros((eeg.shape[0], int(fs * T.RING_SECONDS)))
                self._filled = 0
            k = min(eeg.shape[1], self._buf.shape[1])
            self._buf = np.roll(self._buf, -k, axis=1)
            self._buf[:, -k:] = eeg[:, -k:]
            self._filled = min(self._buf.shape[1], self._filled + k)
            self._new += k
            if msg.get("contact") is not None:
                self._contact = msg["contact"][:, -1]
            if msg.get("accel") is not None:
                self._accel = msg["accel"].mean(axis=1)

    def _filter(self, x: np.ndarray, fs: int) -> np.ndarray:
        sos = butter(4, T.BANDPASS_HZ, btype="bandpass", fs=fs, output="sos")
        y = sosfiltfilt(sos, x, axis=-1)
        if fs / 2 > T.NOTCH_HZ:
            b, a = iirnotch(T.NOTCH_HZ, T.NOTCH_Q, fs)
            y = filtfilt(b, a, y, axis=-1)
        return y

    # ------------------------------------------------------------------ output
    def snapshot(self, now_ms: int) -> dict | None:  # noqa: C901, PLR0912, PLR0915 – one linear pipeline
        with self._lock:
            if self._buf is None or self._fs is None:
                return None
            fs = self._fs
            n_bands = int(fs * T.BANDS_WINDOW_S)
            if self._filled < n_bands:
                return None  # not enough data yet (~2 s after connecting)
            x = self._buf[:, -n_bands:].copy()
            n_new = min(self._new, n_bands)
            self._new = 0
            contact = None if self._contact is None else self._contact.copy()
            accel = None if self._accel is None else self._accel.copy()

        # fraction of samples clipped at the amplifier rail (before filtering)
        clipped = (np.abs(x) >= 0.99 * T.RAIL_UV).mean(axis=1)
        x = x - x.mean(axis=1, keepdims=True)
        y = self._filter(x, fs)
        n_ptp = int(fs * T.PTP_WINDOW_S)
        ptp = np.ptp(y[:, -n_ptp:], axis=1)

        # Blink / spike detector: biggest deviation vs robust sigma (MAD ignores the spike itself)
        med = np.median(y, axis=1, keepdims=True)
        sigma = 1.4826 * np.median(np.abs(y - med), axis=1) + 1e-9
        spike_ratio = np.max(np.abs(y - med), axis=1) / sigma

        names = self.names[: y.shape[0]] + [f"E{i}" for i in range(len(self.names), y.shape[0])]
        quality: dict[str, str] = {}
        channels: dict[str, float] = {}
        artifacts: list[str] = []
        rel_bands: list[tuple[float, float, float]] = []
        freqs, psd = welch(y, fs=fs, nperseg=min(n_bands, int(fs * T.WELCH_SEGMENT_S)), axis=-1)
        for i, name in enumerate(names):
            p = float(ptp[i])
            in_contact = contact is None or contact[i] >= 0.5
            if clipped[i] > T.SATURATED_FRACTION:
                q = "poor"  # pinned at the rail -> no skin contact (not "no signal")
            elif p < T.PTP_FLAT_UV:
                q = "none"
            elif not in_contact or p > T.PTP_MAX_GOOD_UV:
                q = "poor"
            else:
                q = "good"
            quality[name] = q
            total = _band(freqs, psd[i], T.TOTAL) or 1e-12
            th, al, be = (_band(freqs, psd[i], b) / total for b in (T.THETA, T.ALPHA, T.BETA))
            act = (th + al - T.ACTIVITY_REL_LOW) / (T.ACTIVITY_REL_HIGH - T.ACTIVITY_REL_LOW)
            channels[name] = round(float(np.clip(act, 0, 1)), 4) if q == "good" else 0.0
            if q == "good" and spike_ratio[i] > T.SPIKE_SIGMA:
                artifacts.append(name)  # blink / clench in this window -> not used for BRI
            elif q == "good":
                rel_bands.append((th, al, be))

        reliable = len(rel_bands) >= T.MIN_GOOD_CHANNELS
        if reliable:
            th, al, be = (float(np.mean(v)) for v in zip(*rel_bands, strict=True))
        else:
            th = al = be = 0.0

        ratio = None
        if reliable:  # average band powers over time before dividing (a ratio of noisy powers is noisier)
            cur = np.array([th, al, be])
            a = 1 - np.exp(-T.SNAPSHOT_EVERY_S / T.BANDS_TAU_S)
            prev = self._bands_avg
            self._bands_avg = cur if prev is None else prev + a * (cur - prev)
            s_th, s_al, s_be = self._bands_avg
            ratio = float((s_th + s_al) / max(s_be, 1e-6))
        maybe_fatigue = self._fatigue(ratio) if ratio is not None else None
        if reliable and maybe_fatigue is not None:
            self._unreliable = 0
            self._bri = self._smooth(maybe_fatigue)
            if self._bri > T.STOP_ON * 100:
                self._stop = True
            elif self._bri < T.STOP_OFF * 100:
                self._stop = False
        elif not reliable:
            # Artifacts: keep the last BRI for a moment, then report "no data" (never a fake value)
            self._unreliable += 1
            if self._unreliable * T.SNAPSHOT_EVERY_S > T.BRI_HOLD_S:
                self._bri = None
                self._stop = False
                self._raw_hist.clear()
                self._bands_avg = None

        # Raw filtered signal of the samples that arrived since the last snapshot, decimated (admin charts)
        step = max(1, fs // T.WAVE_HZ)
        wave: dict[str, list[float]] = {}
        if n_new > 0:
            tail = y[:, -n_new:]
            usable = (tail.shape[1] // step) * step
            if usable:
                dec = tail[:, -usable:].reshape(tail.shape[0], -1, step).mean(axis=2)
                wave = {n: [round(float(v), 1) for v in dec[i]] for i, n in enumerate(names)}

        saturated = int(np.sum(clipped > T.SATURATED_FRACTION))
        needed = T.BASELINE_SECONDS if self._baseline_mode == "auto" else T.BASELINE_MIN_CLEAN_S
        snap = {
            "tMs": now_ms,
            "reliable": reliable,
            # BRI is relative to this person's resting baseline; null while calibrating
            "calibrating": self._baseline is None,
            "calibrationMode": self._baseline_mode,
            "calibrationProgress": round(
                min(1.0, len(self._baseline_ratios) * T.SNAPSHOT_EVERY_S / needed), 2
            ),
            # electrodes pinned at the amplifier rail (all of them -> reference/bias has no contact)
            "saturated": saturated,
            # good electrodes left out of this window because of a blink / spike
            "artifacts": artifacts,
            "source": "brainaccess-board",
            "channels": channels,
            "ptpUv": {n: round(float(ptp[i]), 1) for i, n in enumerate(names)},
            "quality": quality,
            "bands": {"theta": round(th, 4), "alpha": round(al, 4), "beta": round(be, 4)},
            # fatigue 0..1 = 3 s median of the raw BRI (faster than the smoothed BRI); 0 while calibrating
            "fatigueScore": round(float(np.median(self._raw_hist)) / 100, 4) if self._raw_hist else 0.0,
            # (theta + alpha) / beta (time-averaged bands) now and of this person at rest – the input of BRI
            "ratio": None if ratio is None else round(ratio, 3),
            "baselineRatio": None if self._baseline is None else round(self._baseline, 3),
            "shouldStop": self._stop,
            "bri": None if self._bri is None else round(self._bri, 1),
            "wave": wave,
            "waveHz": fs / step,
        }
        if accel is not None:
            g = accel / T.STANDARD_GRAVITY
            snap["accel"] = {
                "x": round(float(g[0]), 4),
                "y": round(float(g[1]), 4),
                "z": round(float(g[2]), 4),
            }
        return snap
