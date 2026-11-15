# per-person baseline stats and the Brain Rot formula, artifacts/2_processed to artifacts/3_weights/<time>/
# S = sum of w_f * z_f, BRI = 100 * sigmoid((S - s_mid) / s_scale), baseline maps to 25, Instagram to 75
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import mannwhitneyu

import config as C

META = {
    "ts_ms",
    "t_s",
    "settling",
    "eeg_n_good",
    "eeg_artifact_channels",
    "eeg_clean",
    "face_clean",
    "possible_noise",
    "face_present_ratio",
    "motion_g",
}
EEG_PREFIX = (
    "rel_",
    "log_",
    "theta_beta",
    "alpha_theta",
    "fatigue_ratio",
    "engagement",
    "iaf_hz",
    "spectral_entropy",
    "frontal_",
    "posterior_",
)
LOG_FEATURES = {
    "theta_beta",
    "alpha_theta",
    "fatigue_ratio",
    "engagement",
}  # ratios are roughly log-normal, stats and z use log(x)
Z_CLIP = 10.0
EPS = 1e-9


def is_eeg(f: str) -> bool:
    return f.startswith(EEG_PREFIX)


def transform(f: str, v: pd.Series | np.ndarray) -> np.ndarray:
    v = np.asarray(v, float)
    return np.log(np.clip(v, 1e-6, None)) if f in LOG_FEATURES else v


def cohen_d(a: np.ndarray, b: np.ndarray) -> float:
    a, b = a[np.isfinite(a)], b[np.isfinite(b)]
    if len(a) < 3 or len(b) < 3:
        return np.nan
    sp = np.sqrt(((len(a) - 1) * a.var(ddof=1) + (len(b) - 1) * b.var(ddof=1)) / (len(a) + len(b) - 2))
    return float((a.mean() - b.mean()) / (sp + EPS))


def load_session(folder: Path) -> tuple[pd.DataFrame, list[str]]:
    df = pd.read_csv(folder / "features.csv")
    df = df[df["t_s"] >= C.SKIP_SESSION_START_S]
    df = df[(df["settling"] == 0) & (df["phase"] != "transition") & ~df["phase"].isin(C.IGNORED_PHASES)]
    df = df[df["phase"].notna() & (df["phase"] != "")].copy()
    feats = [
        c
        for c in df.columns
        if c not in META and c not in ("phase", "outlier_features") and pd.api.types.is_numeric_dtype(df[c])
    ]
    # EEG features only from clean EEG windows, face features only from clean face windows
    for f in feats:
        bad = (df["eeg_clean"] == 0) if is_eeg(f) else (df["face_clean"] == 0)
        bad |= df["outlier_features"].fillna("").str.split(";").apply(lambda xs, f=f: f in xs)
        df.loc[bad, f] = np.nan
    df["session"] = folder.name
    meta_p = folder / "meta.json"
    subj = json.loads(meta_p.read_text()).get("subject") if meta_p.exists() else None
    df["subject"] = subj or folder.name
    return df, feats


def baseline_params(df: pd.DataFrame, feats: list[str]) -> dict[str, dict[str, float]]:
    base = df[df["phase"] == C.BASELINE_PHASE]
    out = {}
    for f in feats:
        b = transform(f, base[f])
        b = b[np.isfinite(b)]
        allv = transform(f, df[f])
        allv = allv[np.isfinite(allv)]
        if len(b) < 5 or len(allv) < 10:
            continue
        # σ floored at 0.25 of the session std, a near-flat baseline would blow up every z
        sd = max(float(np.std(b, ddof=1)), 0.25 * float(np.std(allv, ddof=1)), EPS)
        out[f] = {
            "mean": float(np.mean(b)),
            "std": sd,
            "raw_mean": float(np.nanmean(base[f])),
            "median": float(np.median(b)),
            "n": int(len(b)),
        }
    return out


def zscore(df: pd.DataFrame, params: dict) -> pd.DataFrame:
    z = pd.DataFrame(index=df.index)
    for f, p in params.items():
        z[f] = ((transform(f, df[f]) - p["mean"]) / p["std"]).clip(-Z_CLIP, Z_CLIP)
    return z


def phase_stats(df: pd.DataFrame, params: dict) -> pd.DataFrame:
    rows = []
    base = df[df["phase"] == C.BASELINE_PHASE]
    for ph, g in df.groupby("phase"):
        for f, p in params.items():
            raw = g[f].to_numpy(float)
            x = transform(f, raw)
            ok = np.isfinite(x)
            if ok.sum() < 3:
                continue
            xb = transform(f, base[f])
            xb = xb[np.isfinite(xb)]
            pval = np.nan
            if ph != C.BASELINE_PHASE and len(xb) >= 3:
                pval = float(mannwhitneyu(x[ok], xb, alternative="two-sided").pvalue)
            raw_mean = float(np.nanmean(raw))
            rows.append(
                {
                    "session": df["session"].iloc[0],
                    "phase": ph,
                    "feature": f,
                    "modality": "eeg" if is_eeg(f) else "face",
                    "n": int(ok.sum()),
                    "mean": raw_mean,
                    "std": float(np.nanstd(raw)),
                    "baseline_mean": p["raw_mean"],
                    "diff_vs_baseline": raw_mean - p["raw_mean"],
                    "multiplier": raw_mean / p["raw_mean"] if abs(p["raw_mean"]) > EPS else np.nan,
                    "z_vs_baseline": float((np.mean(x[ok]) - p["mean"]) / p["std"]),
                    "cohen_d": cohen_d(x[ok], xb),
                    "p_mannwhitney": pval,
                }
            )
    return pd.DataFrame(rows)


def auc(score: np.ndarray, y: np.ndarray) -> float:
    ok = np.isfinite(score)
    s, y = score[ok], y[ok]
    pos, neg = s[y == 1], s[y == 0]
    if not len(pos) or not len(neg):
        return np.nan
    from scipy.stats import rankdata

    r = rankdata(np.r_[pos, neg])
    return float((r[: len(pos)].sum() - len(pos) * (len(pos) + 1) / 2) / (len(pos) * len(neg)))


# leave-one-subject-out with 2+ people, else per session, else k contiguous chunks per phase
def folds(meta: pd.DataFrame, k: int = 5) -> list[np.ndarray]:
    for col in ("subject", "session"):
        if col in meta and meta[col].nunique() >= 2:
            return [(meta[col] == s).to_numpy() for s in meta[col].unique()]
    chunk = np.zeros(len(meta), int)
    for _, idx in meta.groupby("phase").indices.items():
        chunk[idx] = np.minimum(np.arange(len(idx)) * k // max(len(idx), 1), k - 1)
    return [chunk == i for i in range(k)]


def select_features(z: pd.DataFrame, y: np.ndarray) -> tuple[list[str], dict[str, float]]:
    d = {f: cohen_d(z.loc[y == 1, f].to_numpy(), z.loc[y == 0, f].to_numpy()) for f in z.columns}
    avail = {f: z[f].notna().mean() for f in z.columns}
    cand = sorted(
        [f for f in z.columns if np.isfinite(d[f]) and abs(d[f]) >= C.MIN_ABS_EFFECT and avail[f] >= 0.6],
        key=lambda f: -abs(d[f]),
    )
    chosen: list[str] = []
    for f in cand:
        # skip features nearly identical to a stronger one
        if all(abs(z[f].corr(z[g])) < 0.9 for g in chosen):
            chosen.append(f)
    return chosen[:25], d


def effect_weights(z: pd.DataFrame, y: np.ndarray, feats: list[str]) -> dict[str, float]:
    d = {f: cohen_d(z.loc[y == 1, f].to_numpy(), z.loc[y == 0, f].to_numpy()) for f in feats}
    # past |d| ~3 the classes are already separated, the cap keeps one feature from owning the formula
    d = {f: float(np.clip(v, -C.MAX_EFFECT_FOR_WEIGHT, C.MAX_EFFECT_FOR_WEIGHT)) for f, v in d.items()}
    tot = sum(abs(v) for v in d.values()) or 1.0
    return {f: v / tot for f, v in d.items()}


def logreg_weights(z: pd.DataFrame, y: np.ndarray, feats: list[str]) -> dict[str, float]:
    from sklearn.linear_model import LogisticRegression

    m = LogisticRegression(C=0.3, class_weight="balanced", max_iter=2000)
    m.fit(z[feats].fillna(0).to_numpy(), y)
    return dict(zip(feats, map(float, m.coef_[0]), strict=True))


# missing feature counts as baseline (z = 0), NaN when most of the weight is missing
def score(z: pd.DataFrame, w: dict[str, float]) -> np.ndarray:
    zz = z[list(w)]
    wv = np.array(list(w.values()))
    present = zz.notna().to_numpy() @ np.abs(wv) / (np.abs(wv).sum() + EPS)
    s = zz.fillna(0).to_numpy() @ wv
    return np.where(present >= 0.5, s, np.nan)


# contributions pointing away from brain rot count only k times, so this runs high on purpose
def score_sensitive(
    z: pd.DataFrame, w: dict[str, float], k: float = C.SENSITIVE_NEGATIVE_FACTOR
) -> np.ndarray:
    zz = z[list(w)]
    wv = np.array(list(w.values()))
    present = zz.notna().to_numpy() @ np.abs(wv) / (np.abs(wv).sum() + EPS)
    c = zz.fillna(0).to_numpy() * wv
    s = np.clip(c, 0, None).sum(axis=1) + k * np.clip(c, None, 0).sum(axis=1)
    return np.where(present >= 0.5, s, np.nan)


def cv_auc(z: pd.DataFrame, y: np.ndarray, meta: pd.DataFrame, method: str) -> float:
    scores = np.full(len(y), np.nan)
    for test in folds(meta):
        train = ~test
        if len(np.unique(y[train])) < 2:
            continue
        feats, _ = select_features(z[train], y[train])
        if not feats:
            continue
        w = (effect_weights if method == "effect" else logreg_weights)(z[train], y[train], feats)
        scores[test] = score(z[test], w)
    return auc(scores, y)


def calibrate(
    s_base: float, s_rot: float, bri_base: float = C.BRI_AT_BASELINE, bri_rot: float = C.BRI_AT_BRAINROT
) -> dict[str, float]:
    lo = np.log(bri_base / (100 - bri_base))
    hi = np.log(bri_rot / (100 - bri_rot))
    if not np.isfinite(s_rot) or abs(s_rot - s_base) < 1e-6:
        s_rot = s_base + 1.0
    scale = (s_rot - s_base) / (hi - lo)
    mid = s_base - lo * scale
    return {
        "s_mid": float(mid),
        "s_scale": float(scale),
        "s_baseline": float(s_base),
        "s_brainrot": float(s_rot),
    }


def state_model(z: pd.DataFrame, phase: np.ndarray, d_any: dict[str, float]) -> dict:
    feats = [f for f, v in sorted(d_any.items(), key=lambda kv: -kv[1]) if v >= C.MIN_ABS_EFFECT][:30]
    if not feats:
        return {}
    zz = z[feats]
    classes = [p for p in pd.unique(phase)]
    cent = {c: zz[phase == c].mean().fillna(0).to_dict() for c in classes}
    resid = pd.concat([zz[phase == c] - zz[phase == c].mean() for c in classes])
    sd = resid.std().fillna(1).clip(lower=0.2).to_dict()
    return {"features": feats, "classes": classes, "centroids": cent, "within_std": sd}


def state_predict(model: dict, z: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    feats = model["features"]
    x = z[feats].to_numpy()
    sd = np.array([model["within_std"][f] for f in feats])
    ll = []
    for c in model["classes"]:
        mu = np.array([model["centroids"][c][f] for f in feats])
        diff = np.where(np.isfinite(x), (x - mu) / sd, 0.0)
        ll.append(-0.5 * (diff**2).sum(axis=1))
    ll = np.array(ll).T
    p = np.exp(ll - ll.max(axis=1, keepdims=True))
    p /= p.sum(axis=1, keepdims=True)
    return np.array(model["classes"])[p.argmax(axis=1)], p


def resolve_processed(names: list) -> list[Path]:
    if names:
        return [Path(n) if Path(n).exists() else C.PROCESSED_DIR / n for n in names]
    found = sorted(p for p in C.PROCESSED_DIR.glob("*") if (p / "features.csv").exists())
    if not found:
        raise SystemExit(f"no processed sessions in {C.PROCESSED_DIR} – run process.py first")
    return found


def cv_name(meta: pd.DataFrame) -> str:
    if meta["subject"].nunique() >= 2:
        return f"leave-one-subject-out, {meta['subject'].nunique()} people"
    if meta["session"].nunique() >= 2:
        return "leave-one-session-out (one person only!)"
    return "5-fold, contiguous chunks per phase (one session only!)"


def main() -> None:  # noqa: C901, PLR0915
    ap = argparse.ArgumentParser()
    ap.add_argument("folders", nargs="*", help="processed sessions (default: all in artifacts/2_processed)")
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()
    args.folders = resolve_processed(args.folders)

    frames, zs, stats, baselines = [], [], [], {}
    common: set[str] | None = None
    for folder in args.folders:
        df, feats = load_session(folder)
        if C.BASELINE_PHASE not in set(df["phase"]):
            raise SystemExit(f"{folder}: no '{C.BASELINE_PHASE}' windows – cannot normalise")
        params = baseline_params(df, feats)
        baselines[folder.name] = params
        stats.append(phase_stats(df, params))
        frames.append(df)
        zs.append(zscore(df, params))
        common = set(params) if common is None else common & set(params)
    assert common is not None
    feats = sorted(common)
    meta = pd.concat(frames, ignore_index=True)[["session", "subject", "phase", "t_s"]]
    z = pd.concat([x[feats] for x in zs], ignore_index=True)
    stats_df = pd.concat(stats, ignore_index=True)

    out = args.out or C.WEIGHTS_DIR / time.strftime("%Y-%m-%d_%H-%M-%S")
    out.mkdir(parents=True, exist_ok=True)
    stats_df.to_csv(out / "stats_by_phase.csv", index=False, float_format="%.6g")

    phase = meta["phase"].to_numpy()
    mask = np.isin(phase, [C.BRAINROT_PHASE, *C.CALM_PHASES])
    y = (phase[mask] == C.BRAINROT_PHASE).astype(int)
    model: dict = {
        "version": out.name,
        "created": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "sessions": [f.name for f in args.folders],
        "subjects": sorted(meta["subject"].unique().tolist()),
        "log_features": sorted(LOG_FEATURES),
        "z_clip": Z_CLIP,
        "baseline_phase": C.BASELINE_PHASE,
    }
    report: list[str] = [
        f"# Brain Rot model `{out.name}`",
        "",
        f"Sessions: {', '.join(model['sessions'])}",
        "",
    ]
    if y.sum() >= 5 and (1 - y).sum() >= 5:
        zm, mm = z[mask].reset_index(drop=True), meta[mask].reset_index(drop=True)
        cv = {m: cv_auc(zm, y, mm, m) for m in ("effect", "logreg")}
        best = max(cv, key=lambda m: -1 if not np.isfinite(cv[m]) else cv[m])
        sel, d_all = select_features(zm, y)
        if not sel:
            raise SystemExit("no feature differs between Instagram and calm phases (|d| < MIN_ABS_EFFECT)")
        w = (effect_weights if best == "effect" else logreg_weights)(zm, y, sel)
        s_all = score(z, w)
        cal = calibrate(
            float(np.nanmedian(s_all[phase == C.BASELINE_PHASE])),
            float(np.nanmedian(s_all[phase == C.BRAINROT_PHASE])),
        )
        s_sens = score_sensitive(z, w)
        cal_s = calibrate(
            float(np.nanmedian(s_sens[phase == C.BASELINE_PHASE])),
            float(np.nanmedian(s_sens[phase == C.BRAINROT_PHASE])),
            C.BRI_SENSITIVE_AT_BASELINE,
            C.BRI_SENSITIVE_AT_BRAINROT,
        )
        model["sensitive"] = {"negative_factor": C.SENSITIVE_NEGATIVE_FACTOR, "calibration": cal_s}
        model.update(
            method=best, cv_auc=cv, weights=w, calibration=cal, effect_sizes={f: d_all[f] for f in sel}
        )
        report += [
            "## Brain Rot formula",
            "",
            "z_f = (x_f − μ_baseline,f) / σ_baseline,f   (log(x) for ratio features; clipped to ±10)",
            "",
            "S = " + " ".join(f"{v:+.3f}·z[{f}]" for f, v in w.items()),
            "",
            f"BRI = clamp(100 / (1 + exp(−(S − {cal['s_mid']:.3f}) / {cal['s_scale']:.3f})), 0, 100)"
            "   (normal: baseline 25, Instagram 75)",
            "",
            f"S_sensitive = Σ max(c_f, 0) + {C.SENSITIVE_NEGATIVE_FACTOR}·Σ min(c_f, 0),  c_f = w_f·z_f",
            "",
            f"BRI_sensitive = clamp(100 / (1 + exp(−(S_sensitive − {cal_s['s_mid']:.3f}) / "
            f"{cal_s['s_scale']:.3f})), 0, 100)   (inflated: baseline {C.BRI_SENSITIVE_AT_BASELINE:.0f}, "
            f"Instagram {C.BRI_SENSITIVE_AT_BRAINROT:.0f})",
            "",
            f"Method: **{best}** · cross-validated AUC (Instagram vs calm): "
            + ", ".join(f"{m} {v:.3f}" for m, v in cv.items()),
            f"({cv_name(meta)})",
            "",
            "| feature | weight | Cohen's d (insta vs calm) |",
            "|---|---|---|",
        ]
        report += [
            f"| {f} | {v:+.4f} | {d_all[f]:+.2f} |" for f, v in sorted(w.items(), key=lambda kv: -abs(kv[1]))
        ]
    else:
        s_all = np.full(len(z), np.nan)
        s_sens = np.full(len(z), np.nan)
        report += ["**Not enough Instagram / calm windows for the Brain Rot weights.**"]

    d_any = {
        f: max(
            (
                abs(cohen_d(z.loc[phase == p, f].to_numpy(), z.loc[phase == C.BASELINE_PHASE, f].to_numpy()))
                for p in pd.unique(phase)
                if p != C.BASELINE_PHASE
            ),
            default=0.0,
        )
        for f in feats
    }
    d_any = {f: (v if np.isfinite(v) else 0.0) for f, v in d_any.items()}
    sm = state_model(z, phase, d_any)
    if sm:
        pred = np.empty(len(z), dtype=object)
        for test in folds(meta):
            m = state_model(z[~test], phase[~test], d_any)
            if m:
                pred[test] = state_predict(m, z[test])[0]
        acc = float(np.mean(pred == phase))
        sm["cv_accuracy"] = acc
        model["state_model"] = sm
        cm = pd.crosstab(pd.Series(phase, name="true"), pd.Series(pred, name="predicted"))
        cm.to_csv(out / "state_confusion.csv")
        report += [
            "",
            "## Brain state classifier",
            "",
            f"Cross-validated accuracy: {acc:.3f} (chance {1 / len(sm['classes']):.3f})",
            "",
            "```",
            cm.to_string(),
            "```",
        ]

    sig = (
        stats_df.groupby(["phase", "feature"])[["multiplier", "z_vs_baseline", "cohen_d"]]
        .mean()
        .reset_index()
    )
    model["state_signatures"] = {
        ph: {
            r.feature: {"multiplier": r.multiplier, "z": r.z_vs_baseline, "d": r.cohen_d}
            for r in g.itertuples()
        }
        for ph, g in sig.groupby("phase")
    }
    # training baseline, fallback for someone without their own cross (much less accurate)
    model["default_baseline"] = {
        f: {
            k: float(np.mean([b[f][k] for b in baselines.values() if f in b]))
            for k in ("mean", "std", "raw_mean")
        }
        for f in feats
    }
    report += ["", "## Biggest changes vs baseline (z, multiplier)", ""]
    for ph, g in sig[sig["phase"] != C.BASELINE_PHASE].groupby("phase"):
        top = g.reindex(g["z_vs_baseline"].abs().sort_values(ascending=False).index).head(8)
        report += [
            f"**{ph}**: "
            + ", ".join(f"{r.feature} z={r.z_vs_baseline:+.1f} ×{r.multiplier:.2f}" for r in top.itertuples())
        ]

    tl = meta.copy()
    tl["score"] = s_all
    if "calibration" in model:
        cal = model["calibration"]
        tl["bri"] = np.clip(100 / (1 + np.exp(-(s_all - cal["s_mid"]) / cal["s_scale"])), 0, 100)
        cs = model["sensitive"]["calibration"]
        tl["bri_sensitive"] = np.clip(100 / (1 + np.exp(-(s_sens - cs["s_mid"]) / cs["s_scale"])), 0, 100)
        summary = tl.groupby("phase")[["bri", "bri_sensitive"]].median().round(1)
        report += ["", "## BRI per phase (training data)", "", "```", summary.to_string(), "```"]
    if sm:
        tl["state_pred"], _ = state_predict(sm, z)
    tl.to_csv(out / "timeline.csv", index=False, float_format="%.5g")
    _plots(out, tl, model)

    model_json = json.dumps(model, indent=1, default=lambda o: None if o is None else float(o))
    (out / "brainrot_model.json").write_text(model_json)
    # default run also refreshes artifacts/3_weights/brainrot_model.json for brainrot.py
    if args.out is None:
        (C.WEIGHTS_DIR / "brainrot_model.json").write_text(model_json)
    report += [
        "",
        "Interpretation: z = how many baseline standard deviations away from the calm baseline; "
        "multiplier = phase mean / baseline mean. With one session these numbers describe THIS person "
        "only – record several people and re-run with all of them (leave-one-subject-out).",
    ]
    (out / "report.md").write_text("\n".join(report))
    print("\n".join(report))
    print(f"\n-> {out}")


def _plots(out: Path, tl: pd.DataFrame, model: dict) -> None:
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        return
    if "bri" in tl:
        for sess, g in tl.groupby("session"):
            fig, ax = plt.subplots(figsize=(12, 4))
            for ph, gp in g.groupby("phase"):
                ax.scatter(gp["t_s"], gp["bri"], s=6, label=ph)
                if "bri_sensitive" in gp:
                    ax.plot(gp["t_s"], gp["bri_sensitive"], lw=0.6, c="k", alpha=0.4)
            ax.axhline(70, ls="--", c="gray", lw=1)
            ax.set(
                xlabel="time [s]",
                ylabel="BRI",
                ylim=(0, 100),
                title=f"Brain Rot Index – {sess} (dots = BRI, grey line = BRI sensitive)",
            )
            ax.legend(markerscale=3, fontsize=8)
            fig.tight_layout()
            fig.savefig(out / f"timeline_{sess}.png", dpi=120)
            plt.close(fig)
    if "weights" in model:
        w = dict(sorted(model["weights"].items(), key=lambda kv: kv[1]))
        fig, ax = plt.subplots(figsize=(8, max(3, 0.3 * len(w))))
        ax.barh(list(w), list(w.values()), color=["#c44" if v > 0 else "#48c" for v in w.values()])
        ax.set(title="Brain Rot weights (+ = more like Instagram)", xlabel="weight on z")
        fig.tight_layout()
        fig.savefig(out / "weights.png", dpi=120)
        plt.close(fig)


if __name__ == "__main__":
    main()
