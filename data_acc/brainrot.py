# applies the analyze.py formula (artifacts/3_weights/brainrot_model.json) to a processed session,
# CLI writes artifacts/5_predictions/<session>/brainrot_timeline.csv
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

import config as C


class BrainRotModel:
    def __init__(self, model: dict) -> None:
        self.m = model
        self.log_features = set(model.get("log_features", []))
        self.z_clip = model.get("z_clip", 10.0)
        self.baseline: dict = model.get("default_baseline", {})  # training baseline until set_baseline()

    @classmethod
    def load(cls, path: Path = C.WEIGHTS_DIR / "brainrot_model.json") -> BrainRotModel:
        return cls(json.loads(Path(path).read_text()))

    def _t(self, f: str, v: float) -> float:
        return float(np.log(max(v, 1e-6))) if f in self.log_features else float(v)

    def needed_features(self) -> list[str]:
        f = set(self.m.get("weights", {}))
        f |= set(self.m.get("state_model", {}).get("features", []))
        return sorted(f)

    # windows of this person's fixation cross, same std floor as analyze.py
    def set_baseline(self, windows: pd.DataFrame) -> None:
        base = {}
        for f in self.needed_features():
            if f not in windows:
                continue
            v = np.array([self._t(f, x) for x in windows[f].dropna()])
            if len(v) >= 5:
                fallback = self.baseline.get(f, {}).get("std", 0)
                base[f] = {"mean": float(v.mean()), "std": float(max(v.std(ddof=1), 0.5 * fallback, 1e-9))}
        self.baseline = {**self.baseline, **base}

    def z(self, feats: dict) -> dict[str, float]:
        out = {}
        for f in self.needed_features():
            v = feats.get(f)
            b = self.baseline.get(f)
            if v is None or b is None or not np.isfinite(v):
                continue
            out[f] = float(np.clip((self._t(f, v) - b["mean"]) / b["std"], -self.z_clip, self.z_clip))
        return out

    def predict(self, feats: dict) -> dict:
        z = self.z(feats)
        res: dict = {
            "bri": None,
            "bri_sensitive": None,
            "score": None,
            "state": None,
            "state_probs": {},
            "top_factors": [],
        }
        w = self.m.get("weights")
        if w:
            have = sum(abs(v) for f, v in w.items() if f in z) / (sum(abs(v) for v in w.values()) or 1)
            if have >= 0.5:
                contrib = {f: v * z.get(f, 0.0) for f, v in w.items()}
                s = sum(contrib.values())
                cal = self.m["calibration"]
                res["score"] = s
                res["bri"] = float(np.clip(100 / (1 + np.exp(-(s - cal["s_mid"]) / cal["s_scale"])), 0, 100))
                sens = self.m.get("sensitive")
                if sens:
                    k = sens["negative_factor"]
                    s2 = sum(max(c, 0) + k * min(c, 0) for c in contrib.values())
                    cs = sens["calibration"]
                    res["bri_sensitive"] = float(
                        np.clip(100 / (1 + np.exp(-(s2 - cs["s_mid"]) / cs["s_scale"])), 0, 100)
                    )
                res["top_factors"] = sorted(contrib.items(), key=lambda kv: -abs(kv[1]))[:5]
        sm = self.m.get("state_model")
        if sm:
            ll = {}
            for c in sm["classes"]:
                d = [
                    ((z[f] - sm["centroids"][c][f]) / sm["within_std"][f]) ** 2
                    for f in sm["features"]
                    if f in z
                ]
                ll[c] = -0.5 * sum(d)
            mx = max(ll.values())
            p = {c: np.exp(v - mx) for c, v in ll.items()}
            tot = sum(p.values())
            res["state_probs"] = {c: round(v / tot, 3) for c, v in p.items()}
            res["state"] = max(p, key=p.get)
        return res


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("session", help="processed session (path or name in artifacts/2_processed)")
    ap.add_argument("--model", type=Path, default=C.WEIGHTS_DIR / "brainrot_model.json")
    args = ap.parse_args()
    args.folder = Path(args.session) if Path(args.session).exists() else C.PROCESSED_DIR / args.session
    out_dir = C.PREDICTIONS_DIR / args.folder.name
    out_dir.mkdir(parents=True, exist_ok=True)
    model = BrainRotModel.load(args.model)
    df = pd.read_csv(args.folder / "features.csv")
    base = df[
        (df["phase"] == C.BASELINE_PHASE)
        & (df["settling"] == 0)
        & (df["possible_noise"] == 0)
        & (df["t_s"] >= C.SKIP_SESSION_START_S)
    ]
    if len(base) >= 10:
        model.set_baseline(base)
    else:
        print("WARNING: no clean baseline in this session -> using the training baseline (less accurate)")
    rows = []
    for _, r in df.iterrows():
        p = model.predict(r.to_dict())
        rows.append(
            {
                "ts_ms": r["ts_ms"],
                "t_s": r["t_s"],
                "phase": r["phase"],
                "possible_noise": r["possible_noise"],
                "bri": p["bri"],
                "bri_sensitive": p["bri_sensitive"],
                "state": p["state"],
                **{f"p_{k}": v for k, v in p["state_probs"].items()},
            }
        )
    out = pd.DataFrame(rows)
    out.to_csv(out_dir / "brainrot_timeline.csv", index=False, float_format="%.4g")
    print(out.groupby("phase")[["bri", "bri_sensitive"]].median().round(1))
    print(f"-> {out_dir / 'brainrot_timeline.csv'}")


if __name__ == "__main__":
    main()
