# packages the live model into artifacts/7_live/live_model.joblib, loaded by backend/app/brainrot/engine.py
# the backend computes the same features live via process.py, so only the model and calibration go here
from __future__ import annotations

import argparse
import json
import shutil
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.metrics import roc_auc_score

import analyze as A
import config as C
import train_ml as T

P_CLIP = 1e-3


def logit(p: np.ndarray) -> np.ndarray:
    p = np.clip(p, P_CLIP, 1 - P_CLIP)
    return np.log(p / (1 - p))


def labels(phase: np.ndarray, negative: str) -> tuple[np.ndarray, np.ndarray]:
    if negative == "all":
        return np.ones(len(phase), bool), (phase == C.BRAINROT_PHASE).astype(int)
    mask = np.isin(phase, [C.BRAINROT_PHASE, *C.CALM_PHASES])
    return mask, (phase[mask] == C.BRAINROT_PHASE).astype(int)


# out-of-fold probability for every window, including phases left out of training
def loso(X: pd.DataFrame, y_all: np.ndarray, train_mask: np.ndarray, meta: pd.DataFrame) -> np.ndarray:
    p = np.full(len(X), np.nan)
    for test in A.folds(meta):
        tr = ~test & train_mask
        m = T.make_model(C.LIVE_MODEL).fit(X[tr], y_all[tr])
        p[test] = m.predict_proba(X[test])[:, 1]
    return p


def main() -> None:  # noqa: PLR0915
    ap = argparse.ArgumentParser()
    ap.add_argument("folders", nargs="*", help="processed sessions (default: all in artifacts/2_processed)")
    args = ap.parse_args()
    folders = A.resolve_processed(args.folders)
    meta, z, _raw, feats = T.load_all(folders)
    cols = T.feature_set(feats, C.LIVE_FEATURES)
    phase = meta["phase"].to_numpy()
    X = z[cols]
    calm = np.isin(phase, [C.BRAINROT_PHASE, *C.CALM_PHASES])
    y_rot = (phase == C.BRAINROT_PHASE).astype(int)
    print(
        f"{len(folders)} sessions, {meta['subject'].nunique()} people, {len(cols)} features, CV: {A.cv_name(meta)}"
    )

    results = {}
    for negative in ("calm", "all"):
        mask, y = labels(phase, negative)
        y_all = np.full(len(phase), -1)
        y_all[mask] = y
        p = loso(X, y_all, mask, meta)
        auc_calm = roc_auc_score(y_rot[calm], p[calm])
        lg = logit(p)
        cal = A.calibrate(
            float(np.median(lg[phase == C.BASELINE_PHASE])), float(np.median(lg[phase == C.BRAINROT_PHASE]))
        )
        bri = 100 / (1 + np.exp(-(lg - cal["s_mid"]) / cal["s_scale"]))
        per_phase = pd.Series(bri).groupby(phase).median().round(1).to_dict()
        per_subj = {
            s: round(
                roc_auc_score(
                    y_rot[(meta["subject"] == s).to_numpy() & calm],
                    p[(meta["subject"] == s).to_numpy() & calm],
                ),
                3,
            )
            for s in meta["subject"].unique()
        }
        results[negative] = {
            "mask": mask,
            "y": y,
            "cal": cal,
            "auc_calm": auc_calm,
            "per_phase": per_phase,
            "per_subject": per_subj,
        }
        print(f"[negative={negative}] AUC Instagram vs calm {auc_calm:.3f} · BRI per phase {per_phase}")

    chosen = results[C.LIVE_NEGATIVE]
    final = T.make_model(C.LIVE_MODEL).fit(X[chosen["mask"]], chosen["y"])
    # fallback baseline used before the person's own cross, mean over the training people
    base = {}
    for f in folders:
        df, fs = A.load_session(f)
        for k, v in A.baseline_params(df, fs).items():
            base.setdefault(k, []).append(v)
    default_baseline = {
        k: {"mean": float(np.mean([b["mean"] for b in v])), "std": float(np.mean([b["std"] for b in v]))}
        for k, v in base.items()
        if k in cols
    }

    out = C.LIVE_DIR / time.strftime("%Y-%m-%d_%H-%M-%S")
    out.mkdir(parents=True, exist_ok=True)
    bundle = {
        "model": final,
        "features": cols,
        "log_features": sorted(A.LOG_FEATURES),
        "z_clip": A.Z_CLIP,
        "calibration": chosen["cal"],
        "p_clip": P_CLIP,
        "default_baseline": default_baseline,
        "skip_baseline_s": C.SKIP_SESSION_START_S,
        "window_s": C.WINDOW_S,
        "step_s": C.STEP_S,
        "config": f"{C.LIVE_MODEL} | {C.LIVE_FEATURES} | z | negative={C.LIVE_NEGATIVE}",
        "auc_instagram_vs_calm": chosen["auc_calm"],
        "sklearn_version": sklearn.__version__,
        "sessions": [f.name for f in folders],
        "created": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    joblib.dump(bundle, out / "live_model.joblib")
    shutil.copy2(out / "live_model.joblib", C.LIVE_DIR / "live_model.joblib")
    lines = [
        f"# Live model `{out.name}`",
        "",
        f"Config: **{bundle['config']}** · sklearn {sklearn.__version__}",
        f"CV: {A.cv_name(meta)}",
        "",
        "| negative class | AUC Instagram vs calm | BRI baseline | calm video | "
        "look around | thinking | Instagram |",
        "|---|---|---|---|---|---|---|",
    ]
    for neg, r in results.items():
        pp = r["per_phase"]
        lines.append(
            f"| {neg}{' (chosen)' if neg == C.LIVE_NEGATIVE else ''} | {r['auc_calm']:.3f} | "
            + " | ".join(
                str(pp.get(k, "–"))
                for k in ("baseline", "calm_video", "look_around", "mental_effort", "instagram")
            )
            + " |"
        )
    lines += [
        "",
        "Per person AUC (chosen): " + json.dumps(chosen["per_subject"]),
        "",
        f"Calibration: BRI = 100·sigmoid((logit(p) − {chosen['cal']['s_mid']:.3f}) / {chosen['cal']['s_scale']:.3f})",
        "",
        "Switch the negative class with LIVE_NEGATIVE in config.py and run export_live.py again.",
    ]
    (out / "report.md").write_text("\n".join(lines))
    print("\n".join(lines))
    print(f"\n-> {C.LIVE_DIR / 'live_model.joblib'}")


if __name__ == "__main__":
    main()
