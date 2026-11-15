# sync + clean sessions into artifacts/2_processed/<session>/ (synced.csv, features.csv, processing.json)
# build_synced, eeg_window and face_window are also imported live by backend/app/brainrot/engine.py
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.signal import welch

import config as C
from eeg_device import bandpass_notch

SYNC_INCLUDE_BLENDSHAPES = False  # bs_* always go to features.csv, synced.csv gets huge with them


def load_events(folder: Path) -> list[dict]:
    meta_p = folder / "meta.json"
    if meta_p.exists():
        phases = json.loads(meta_p.read_text()).get("phases") or []
        if phases:
            return phases
    if not (folder / "events.csv").exists():
        return []
    ev = pd.read_csv(folder / "events.csv")
    out, open_ = [], {}
    for _, r in ev.iterrows():
        if r["event"] == "phase_start":
            open_[r["phase"]] = r["ts_ms"]
        elif r["event"] == "phase_end" and r["phase"] in open_:
            out.append({"id": r["phase"], "start_ms": open_.pop(r["phase"]), "end_ms": r["ts_ms"]})
    return out


def load_eeg(folder: Path) -> tuple[pd.DataFrame | None, dict]:
    p = folder / "eeg_raw.csv"
    if not p.exists():
        return None, {"eeg": "missing"}
    df = pd.read_csv(p)
    df = df.rename(columns={"accel_x_ms2": "accel_x", "accel_y_ms2": "accel_y", "accel_z_ms2": "accel_z"})
    info: dict = {"samples": len(df)}
    if "sample_number" in df and df["sample_number"].notna().all() and len(df) > 100:
        df = df.drop_duplicates("sample_number").sort_values("sample_number").reset_index(drop=True)
        sn = df["sample_number"].to_numpy(float)
        ts = df["ts_ms"].to_numpy(float)
        slope = np.polyfit(sn, ts, 1)[0]
        # Bluetooth / chunking only ever delays arrival, so the lower envelope is the real sample time
        offset = np.percentile(ts - slope * sn, 5)
        fitted = offset + slope * sn
        info.update(
            ts_fit_ms_per_sample=round(slope, 5),
            fs_est=round(1000 / slope, 2),
            jitter_ms_p50=round(float(np.median(ts - fitted)), 1),
            jitter_ms_p95=round(float(np.percentile(ts - fitted, 95)), 1),
            lost_samples=int((np.diff(sn) - 1).clip(0).sum()),
        )
        df["ts_ms"] = fitted
    else:
        df = df.sort_values("ts_ms").reset_index(drop=True)
    if "streaming" in df:
        info["filled_samples"] = int((df["streaming"] == 0).sum())
    return df, info


def load_face(folder: Path) -> pd.DataFrame | None:
    p = folder / "face.csv"
    if not p.exists():
        return None
    df = pd.read_csv(p).sort_values("ts_ms").reset_index(drop=True)
    return df


# grid points inside a source gap longer than max_gap become NaN
def interp_with_gaps(t_src: np.ndarray, y: np.ndarray, t_grid: np.ndarray, max_gap: float) -> np.ndarray:
    ok = np.isfinite(y)
    if ok.sum() < 2:
        return np.full(len(t_grid), np.nan)
    ts, ys = t_src[ok], y[ok]
    out = np.interp(t_grid, ts, ys, left=np.nan, right=np.nan)
    i = np.searchsorted(ts, t_grid).clip(1, len(ts) - 1)
    gap = ts[i] - ts[i - 1]
    inside = (t_grid >= ts[i - 1]) & (t_grid <= ts[i])
    out[inside & (gap > max_gap)] = np.nan
    return out


def contiguous(mask: np.ndarray) -> list[tuple[int, int]]:
    d = np.diff(np.r_[0, mask.astype(int), 0])
    return list(zip(np.flatnonzero(d == 1), np.flatnonzero(d == -1), strict=True))


def phase_labels(t_ms: np.ndarray, phases: list[dict]) -> np.ndarray:
    lab = np.full(len(t_ms), "", dtype=object)
    for p in phases:
        lab[(t_ms >= p["start_ms"]) & (t_ms < p["end_ms"])] = p["id"]
    return lab


def build_synced(
    eeg: pd.DataFrame | None, face: pd.DataFrame | None, phases: list[dict]
) -> tuple[pd.DataFrame, list[str]]:
    starts = [d["ts_ms"].iloc[0] for d in (eeg, face) if d is not None and len(d)]
    ends = [d["ts_ms"].iloc[-1] for d in (eeg, face) if d is not None and len(d)]
    if phases:
        starts.append(phases[0]["start_ms"])
        ends.append(phases[-1]["end_ms"])
    t0, t1 = max(starts), min(ends)
    grid = np.arange(t0, t1, 1000.0 / C.SYNC_HZ)
    out = pd.DataFrame({"ts_ms": grid, "t_s": (grid - grid[0]) / 1000.0, "phase": phase_labels(grid, phases)})
    channels: list[str] = []
    fs = C.SYNC_HZ

    if eeg is not None:
        channels = [c[:-3] for c in eeg.columns if c.endswith("_uv")]
        t_src = eeg["ts_ms"].to_numpy(float)
        gap_any = np.zeros(len(grid), bool)
        for ch in channels:
            raw = eeg[f"{ch}_uv"].to_numpy(float)
            if "streaming" in eeg:
                raw = np.where(
                    eeg["streaming"].to_numpy() == 0, np.nan, raw
                )  # samples filled in by the device
            clip_src = (np.abs(raw) >= 0.99 * C.RAIL_UV).astype(float)
            x = interp_with_gaps(t_src, raw, grid, C.MAX_INTERP_GAP_MS)
            gap = np.isnan(x)
            gap_any |= gap
            y = np.full(len(grid), np.nan)
            for a, b in contiguous(~gap):
                if b - a > 3 * fs:  # filter each gap-free segment on its own
                    seg = x[a:b] - np.mean(x[a:b])
                    y[a:b] = bandpass_notch(seg, fs)
            clipped = np.interp(grid, t_src, clip_src) > 0.5
            contact = np.ones(len(grid), bool)
            if f"{ch}_contact" in eeg:
                contact = np.interp(grid, t_src, eeg[f"{ch}_contact"].to_numpy(float)) >= 0.5
            spike = np.zeros(len(grid), bool)
            blk = 10 * fs
            for a in range(0, len(y), blk):
                s = y[a : a + blk]
                if np.isfinite(s).sum() < fs:
                    continue
                med = np.nanmedian(s)
                sig = 1.4826 * np.nanmedian(np.abs(s - med)) + 1e-9
                spike[a : a + blk] = np.abs(s - med) > C.SPIKE_SIGMA * sig
            out[f"{ch}_uv"] = y
            out[f"{ch}_bad"] = (clipped | ~contact | spike | np.isnan(y)).astype(np.int8)
        out["eeg_gap"] = gap_any.astype(np.int8)
        if {"accel_x", "accel_y", "accel_z"} <= set(eeg.columns) and eeg["accel_x"].notna().any():
            acc = np.sqrt(sum(eeg[c].to_numpy(float) ** 2 for c in ("accel_x", "accel_y", "accel_z")))
            g = acc / 9.80665 if np.nanmedian(acc) > 3 else acc  # m/s² to g
            out["accel_g"] = interp_with_gaps(t_src, g, grid, C.MAX_INTERP_GAP_MS)

    face_cols: list[str] = []
    if face is not None and len(face):
        tf = face["ts_ms"].to_numpy(float)
        present = face["face_present"].to_numpy(float) > 0.5
        face_cols = [
            c for c in face.columns if c not in ("ts_ms", "frame_idx", "inference_ms", "face_present")
        ]
        out["face_present"] = (interp_with_gaps(tf, present.astype(float), grid, 250) > 0.5).astype(np.int8)
        for c in face_cols:
            v = face[c].to_numpy(float)
            v = np.where(present, v, np.nan)  # no face means NaN, not 0
            out[c] = interp_with_gaps(tf, v, grid, C.MAX_INTERP_GAP_MS)
        out["face_gap"] = out["ear_avg"].isna().astype(np.int8) if "ear_avg" in out else 1
    return out, channels


def _bp(freqs: np.ndarray, psd: np.ndarray, lo: float, hi: float) -> float:
    m = (freqs >= lo) & (freqs < hi)
    return float(np.trapezoid(psd[m], freqs[m])) if m.any() else np.nan


def eeg_window(seg: pd.DataFrame, channels: list[str], fs: int) -> dict:  # noqa: C901
    f: dict = {}
    good_bands: dict[str, dict[str, float]] = {}
    artifacts = 0
    for ch in channels:
        y = seg[f"{ch}_uv"].to_numpy(float)
        bad = seg[f"{ch}_bad"].to_numpy()
        if np.isnan(y).mean() > 0.05 or bad.mean() > 0.10:
            continue
        y = np.nan_to_num(y - np.nanmean(y))
        if np.ptp(y) > C.WINDOW_MAX_PTP_UV:
            artifacts += 1
            continue
        med = np.median(y)
        if np.max(np.abs(y - med)) > C.SPIKE_SIGMA * (1.4826 * np.median(np.abs(y - med)) + 1e-9):
            artifacts += 1
            continue
        freqs, psd = welch(y, fs=fs, nperseg=min(len(y), fs))
        total = _bp(freqs, psd, *C.REL_TOTAL) or 1e-12
        b = {name: _bp(freqs, psd, lo, hi) for name, (lo, hi) in C.EEG_BANDS.items()}
        b["_total"] = total
        m = (freqs >= 7) & (freqs <= 13)
        b["_iaf"] = float(freqs[m][np.argmax(psd[m])]) if m.any() else np.nan
        p = psd[(freqs >= C.REL_TOTAL[0]) & (freqs < C.REL_TOTAL[1])]
        p = p / (p.sum() + 1e-12)
        b["_entropy"] = float(-(p * np.log(p + 1e-12)).sum() / np.log(len(p)))
        good_bands[ch] = b
    f["eeg_n_good"] = len(good_bands)
    f["eeg_artifact_channels"] = artifacts
    if not good_bands:
        return f
    for name in C.EEG_BANDS:
        rel = [b[name] / b["_total"] for b in good_bands.values()]
        f[f"rel_{name}"] = float(np.mean(rel))
        f[f"log_{name}"] = float(np.mean([np.log10(b[name] + 1e-12) for b in good_bands.values()]))
    th, al, be = (f[f"rel_{k}"] for k in ("theta", "alpha", "beta"))
    f["theta_beta"] = th / max(be, 1e-6)
    f["alpha_theta"] = al / max(th, 1e-6)
    f["fatigue_ratio"] = (th + al) / max(be, 1e-6)  # Jap et al. 2009, same as the backend BRI input
    f["engagement"] = be / max(al + th, 1e-6)  # Pope et al. 1995
    f["iaf_hz"] = float(np.nanmean([b["_iaf"] for b in good_bands.values()]))
    f["spectral_entropy"] = float(np.mean([b["_entropy"] for b in good_bands.values()]))
    front = [good_bands[c] for c in ("F3", "F4") if c in good_bands]
    post = [good_bands[c] for c in ("O1", "O2", "P3", "P4") if c in good_bands]
    if front:
        f["frontal_theta_rel"] = float(np.mean([b["theta"] / b["_total"] for b in front]))
    if post:
        f["posterior_alpha_rel"] = float(np.mean([b["alpha"] / b["_total"] for b in post]))
    if "F3" in good_bands and "F4" in good_bands:  # frontal alpha asymmetry
        f["frontal_alpha_asym"] = float(
            np.log(good_bands["F4"]["alpha"] + 1e-12) - np.log(good_bands["F3"]["alpha"] + 1e-12)
        )
    return f


FACE_MEAN = [
    "ear_avg",
    "gaze_x",
    "gaze_y",
    "head_yaw_deg",
    "head_pitch_deg",
    "head_roll_deg",
    "brow_furrow",
    "brow_raise",
    "eye_squint",
    "eye_wide",
    "jaw_open",
    "smile",
    "mouth_frown",
    "face_scale",
]


def face_window(seg: pd.DataFrame, fs: int) -> dict:
    f: dict = {"face_present_ratio": float(seg["face_present"].mean())}
    if seg["ear_avg"].notna().sum() < 0.3 * len(seg):
        return f
    for c in FACE_MEAN:
        if c in seg:
            f[c] = float(seg[c].mean())
    closed = (seg["blink_bs"].fillna(0) > 0.5).to_numpy().astype(int)
    dur_s = len(seg) / fs
    f["blink_rate_per_min"] = float((np.diff(closed) == 1).sum() / dur_s * 60)
    f["perclos"] = float((seg["ear_avg"] < C.EAR_CLOSED).mean())
    gx, gy = seg["gaze_x"].to_numpy(float), seg["gaze_y"].to_numpy(float)
    f["gaze_dispersion"] = float(np.nanstd(gx) + np.nanstd(gy))
    f["gaze_speed"] = float(np.nanmean(np.hypot(np.diff(gx), np.diff(gy))) * fs)
    f["head_motion"] = float(np.nanstd(seg["nose_x"]) + np.nanstd(seg["nose_y"]))
    f["head_yaw_std"] = float(np.nanstd(seg["head_yaw_deg"]))
    f["head_pitch_std"] = float(np.nanstd(seg["head_pitch_deg"]))
    f["jaw_open_max"] = float(np.nanmax(seg["jaw_open"]))
    for c in seg.columns:
        if c.startswith("bs_"):
            f[c] = float(seg[c].mean())
    return f


def window_features(synced: pd.DataFrame, channels: list[str], phases: list[dict]) -> pd.DataFrame:
    fs = C.SYNC_HZ
    n_win, n_step = int(C.WINDOW_S * fs), int(C.STEP_S * fs)
    t = synced["ts_ms"].to_numpy()
    starts = {p["id"]: p["start_ms"] for p in phases}
    rows = []
    for a in range(0, len(synced) - n_win + 1, n_step):
        seg = synced.iloc[a : a + n_win]
        labels = seg["phase"].unique()
        center = float(t[a + n_win // 2])
        ph = labels[0] if len(labels) == 1 and labels[0] else "transition"
        settling = ph in starts and (t[a] - starts[ph]) < C.PHASE_SETTLE_S * 1000
        r: dict = {
            "ts_ms": center,
            "t_s": float(synced["t_s"].iloc[a + n_win // 2]),
            "phase": ph,
            "settling": int(settling),
        }
        if channels:
            r.update(eeg_window(seg, channels, fs))
            if "accel_g" in seg:
                r["motion_g"] = float(np.nanstd(seg["accel_g"]))
        if "face_present" in seg:
            r.update(face_window(seg, fs))
        rows.append(r)
    df = pd.DataFrame(rows)
    df["eeg_clean"] = 0
    if channels and "eeg_n_good" in df:
        ok = df["eeg_n_good"] >= C.MIN_GOOD_CHANNELS
        if "motion_g" in df:
            ok &= df["motion_g"].fillna(0) < C.ACCEL_MOTION_G
        df["eeg_clean"] = ok.astype(int)
    has_face = "face_present_ratio" in df
    df["face_clean"] = (df["face_present_ratio"] >= 0.8).astype(int) if has_face else 0
    noise = np.zeros(len(df), bool)
    if channels:
        noise |= df["eeg_clean"].to_numpy() == 0
    if has_face:
        noise |= df["face_clean"].to_numpy() == 0
    df["possible_noise"] = noise.astype(int)
    # per-phase robust outliers catch noise the flags above missed
    key = [
        c
        for c in (
            "fatigue_ratio",
            "rel_alpha",
            "rel_theta",
            "log_delta",
            "blink_rate_per_min",
            "gaze_speed",
            "head_motion",
        )
        if c in df
    ]
    out_names = [[] for _ in range(len(df))]
    for ph, g in df.groupby("phase"):
        for c in key:
            v = g[c]
            med = v.median()
            # std floor because count features like blinks have MAD 0 in most windows
            mad = max(1.4826 * (v - med).abs().median(), 0.5 * v.std(), 1e-9)
            for i in g.index[((v - med).abs() / mad) > C.FEATURE_OUTLIER_Z]:
                out_names[i].append(c)
    df["outlier_features"] = [";".join(x) for x in out_names]
    df.loc[df["outlier_features"] != "", "possible_noise"] = 1
    return df


def process(folder: Path) -> None:
    out = C.PROCESSED_DIR / folder.name
    out.mkdir(parents=True, exist_ok=True)
    print(f"== {folder} -> {out}")
    for name in ("meta.json", "events.csv"):
        if (folder / name).exists():
            shutil.copy2(folder / name, out / name)
    phases = load_events(folder)
    eeg, eeg_info = load_eeg(folder)
    face = load_face(folder)
    if eeg is None and face is None:
        raise SystemExit("no eeg_raw.csv and no face.csv")
    synced, channels = build_synced(eeg, face, phases)
    to_write = synced
    if not SYNC_INCLUDE_BLENDSHAPES:
        to_write = synced[[c for c in synced.columns if not c.startswith("bs_")]]
    to_write.to_csv(out / "synced.csv", index=False, float_format="%.5g")
    feats = window_features(synced, channels, phases)
    feats.to_csv(out / "features.csv", index=False, float_format="%.6g")

    report: dict = {
        "eeg": eeg_info,
        "channels": channels,
        "grid_hz": C.SYNC_HZ,
        "duration_s": round(float(synced["t_s"].iloc[-1]), 1),
        "phases": {},
    }
    if channels:
        report["eeg_gap_pct"] = round(100 * float(synced["eeg_gap"].mean()), 2)
        report["channel_bad_pct"] = {c: round(100 * float(synced[f"{c}_bad"].mean()), 1) for c in channels}
    if "face_gap" in synced:
        report["face_gap_pct"] = round(100 * float(synced["face_gap"].mean()), 2)
    for ph, g in feats.groupby("phase"):
        report["phases"][ph] = {
            "windows": len(g),
            "possible_noise_pct": round(100 * g["possible_noise"].mean(), 1),
            "eeg_clean_pct": round(100 * g["eeg_clean"].mean(), 1),
            "face_clean_pct": round(100 * g["face_clean"].mean(), 1),
        }
    (out / "processing.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    print(f"-> {out / 'synced.csv'}\n-> {out / 'features.csv'}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("sessions", nargs="*", help="session folders or names (default: all new ones)")
    ap.add_argument("--force", action="store_true", help="process again even if already processed")
    args = ap.parse_args()
    if args.sessions:
        folders = [Path(s) if Path(s).exists() else C.SESSIONS_DIR / s for s in args.sessions]
    else:
        folders = sorted(p for p in C.SESSIONS_DIR.glob("*") if p.is_dir())
        if not args.force:
            folders = [p for p in folders if not (C.PROCESSED_DIR / p.name / "features.csv").exists()]
    if not folders:
        print(f"nothing to process in {C.SESSIONS_DIR} (use --force to redo)")
    for f in folders:
        process(f)


if __name__ == "__main__":
    main()
