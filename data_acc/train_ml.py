# classic ML models vs the hand-made formula, writes artifacts/4_ml/<time>/
# same windows and folds as analyze.py so the scores compare 1:1, export_live.py reuses make_model / load_all
from __future__ import annotations

import argparse
import time
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import balanced_accuracy_score, f1_score, roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

import analyze as A
import config as C

warnings.filterwarnings("ignore", category=UserWarning)


def make_model(name: str):
    if name == "logreg":
        return make_pipeline(
            SimpleImputer(strategy="median"),
            StandardScaler(),
            LogisticRegression(C=0.3, class_weight="balanced", max_iter=3000),
        )
    if name == "random_forest":
        return make_pipeline(
            SimpleImputer(strategy="median"),
            RandomForestClassifier(
                n_estimators=300, min_samples_leaf=5, class_weight="balanced", n_jobs=-1, random_state=0
            ),
        )
    if name == "grad_boost":
        return HistGradientBoostingClassifier(  # handles NaN natively
            max_depth=3, learning_rate=0.05, max_iter=300, class_weight="balanced", random_state=0
        )
    raise ValueError(name)


MODELS = ["logreg", "random_forest", "grad_boost"]


def load_all(folders: list[Path]) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, list[str]]:
    frames, zs, raws, common = [], [], [], None
    for f in folders:
        df, feats = A.load_session(f)
        params = A.baseline_params(df, feats)
        frames.append(df)
        zs.append(A.zscore(df, params))
        raws.append(pd.DataFrame({k: A.transform(k, df[k]) for k in params}, index=df.index))
        common = set(params) if common is None else common & set(params)
    feats = sorted(common or [])
    meta = pd.concat(frames, ignore_index=True)[["session", "subject", "phase", "t_s"]]
    z = pd.concat([x[feats] for x in zs], ignore_index=True)
    raw = pd.concat([x[feats] for x in raws], ignore_index=True)
    return meta, z, raw, feats


def feature_set(feats: list[str], which: str) -> list[str]:
    if which == "eeg":
        return [f for f in feats if A.is_eeg(f)]
    if which == "face":
        return [f for f in feats if not A.is_eeg(f)]
    return feats


def task_data(meta: pd.DataFrame, task: str) -> tuple[np.ndarray, np.ndarray]:
    phase = meta["phase"].to_numpy()
    if task == "brainrot":
        mask = np.isin(phase, [C.BRAINROT_PHASE, *C.CALM_PHASES])
        return mask, (phase[mask] == C.BRAINROT_PHASE).astype(int)
    return np.ones(len(phase), bool), phase


def evaluate(y: np.ndarray, pred: np.ndarray, proba: np.ndarray | None, task: str) -> dict:
    ok = pd.notna(pred)
    if ok.sum() == 0:
        return {}
    out = {"n": int(ok.sum()), "balanced_acc": balanced_accuracy_score(y[ok], pred[ok].astype(y.dtype))}
    if task == "brainrot":
        out["auc"] = roc_auc_score(y[ok], proba[ok]) if len(np.unique(y[ok])) == 2 else np.nan
    else:
        out["macro_f1"] = f1_score(y[ok], pred[ok].astype(y.dtype), average="macro")
    return out


def run_cv(X: pd.DataFrame, y: np.ndarray, meta: pd.DataFrame, model: str, task: str):
    pred = np.full(len(y), None, dtype=object)
    proba = np.full(len(y), np.nan)
    for test in A.folds(meta):
        train = ~test
        if len(np.unique(y[train])) < 2 or not test.any():
            continue
        m = make_model(model).fit(X[train], y[train])
        pred[test] = m.predict(X[test])
        if task == "brainrot":
            proba[test] = m.predict_proba(X[test])[:, 1]
    return pred, proba


# analyze.py formula in the same folds, threshold halfway between the training medians
def formula_cv(z: pd.DataFrame, y: np.ndarray, meta: pd.DataFrame, method: str):
    score = np.full(len(y), np.nan)
    pred = np.full(len(y), None, dtype=object)
    for test in A.folds(meta):
        train = ~test
        if len(np.unique(y[train])) < 2:
            continue
        feats, _ = A.select_features(z[train], y[train])
        if not feats:
            continue
        w = (A.effect_weights if method == "effect" else A.logreg_weights)(z[train], y[train], feats)
        s_tr, s_te = A.score(z[train], w), A.score(z[test], w)
        thr = (np.nanmedian(s_tr[y[train] == 1]) + np.nanmedian(s_tr[y[train] == 0])) / 2
        score[test] = s_te
        pred[test] = np.where(np.isfinite(s_te), (s_te > thr).astype(int), None)
    return pred, score


def nb_state_cv(z: pd.DataFrame, phase: np.ndarray, meta: pd.DataFrame):
    pred = np.full(len(phase), None, dtype=object)
    for test in A.folds(meta):
        train = ~test
        base = phase[train] == C.BASELINE_PHASE
        d_any = {}
        for f in z.columns:
            ds = [
                abs(
                    A.cohen_d(z.loc[train][phase[train] == p][f].to_numpy(), z.loc[train][base][f].to_numpy())
                )
                for p in np.unique(phase[train])
                if p != C.BASELINE_PHASE
            ]
            ds = [d for d in ds if np.isfinite(d)]
            d_any[f] = max(ds) if ds else 0.0
        m = A.state_model(z[train], phase[train], d_any)
        if m:
            pred[test] = A.state_predict(m, z[test])[0]
    return pred


def per_subject(y, pred, proba, meta, task, label) -> list[dict]:
    rows = []
    for s in meta["subject"].unique():
        idx = (meta["subject"] == s).to_numpy()
        r = evaluate(y[idx], pred[idx], None if proba is None else proba[idx], task)
        if r:
            rows.append({"config": label, "task": task, "subject": s, **r})
    return rows


def main() -> None:  # noqa: C901, PLR0915
    ap = argparse.ArgumentParser()
    ap.add_argument("folders", nargs="*", help="processed sessions (default: all in artifacts/2_processed)")
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()
    folders = A.resolve_processed(args.folders)
    meta_all, z_all, raw_all, feats = load_all(folders)
    out = args.out or C.ML_DIR / time.strftime("%Y-%m-%d_%H-%M-%S")
    out.mkdir(parents=True, exist_ok=True)
    cvn = A.cv_name(meta_all)
    print(
        f"{len(folders)} sessions, {meta_all['subject'].nunique()} people, {len(feats)} features, CV: {cvn}"
    )

    metrics, subj_rows, best = [], [], {}
    for task in ("brainrot", "state"):
        mask, y = task_data(meta_all, task)
        meta = meta_all[mask].reset_index(drop=True)
        if len(np.unique(y)) < 2:
            print(f"[{task}] skipped – fewer than 2 classes")
            continue
        main_metric = "auc" if task == "brainrot" else "balanced_acc"
        results = []
        for rep, data in (("z", z_all), ("raw", raw_all)):
            for fs_name in ("all", "eeg", "face"):
                cols = feature_set(feats, fs_name)
                if not cols:
                    continue
                X = data[mask].reset_index(drop=True)[cols]
                for model in MODELS:
                    label = f"{model} | {fs_name} | {rep}"
                    pred, proba = run_cv(X, y, meta, model, task)
                    r = evaluate(y, pred, proba if task == "brainrot" else None, task)
                    results.append((r.get(main_metric, np.nan), label, model, fs_name, rep, pred, proba))
                    metrics.append(
                        {
                            "task": task,
                            "config": label,
                            "model": model,
                            "features": fs_name,
                            "representation": rep,
                            "n_features": len(cols),
                            **r,
                        }
                    )
                    subj_rows += per_subject(
                        y, pred, proba if task == "brainrot" else None, meta, task, label
                    )
                    print(f"[{task}] {label:38s} {main_metric}={r.get(main_metric, np.nan):.3f}")
        zt = z_all[mask].reset_index(drop=True)
        if task == "brainrot":
            for method in ("effect", "logreg"):
                pred, score = formula_cv(zt, y, meta, method)
                r = evaluate(y, pred, score, task)
                label = f"FORMULA ({method} weights) | all | z"
                metrics.append(
                    {
                        "task": task,
                        "config": label,
                        "model": f"formula_{method}",
                        "features": "all",
                        "representation": "z",
                        **r,
                    }
                )
                subj_rows += per_subject(y, pred, score, meta, task, label)
                print(f"[{task}] {label:38s} auc={r.get('auc', np.nan):.3f}")
        else:
            pred = nb_state_cv(zt, y, meta)
            r = evaluate(y, pred, None, task)
            label = "NAIVE-BAYES state model | all | z"
            metrics.append(
                {
                    "task": task,
                    "config": label,
                    "model": "naive_bayes",
                    "features": "all",
                    "representation": "z",
                    **r,
                }
            )
            subj_rows += per_subject(y, pred, None, meta, task, label)
            print(f"[{task}] {label:38s} balanced_acc={r.get('balanced_acc', np.nan):.3f}")

        results = [r for r in results if np.isfinite(r[0])]
        # best_<task>.joblib must come from the configured feature set
        if C.ML_FINAL_FEATURES:
            results = [r for r in results if r[3] == C.ML_FINAL_FEATURES] or results
        if not results:
            continue
        score_, label, model, fs_name, rep, pred, proba = max(results, key=lambda r: r[0])
        best[task] = {"config": label, main_metric: score_}
        cols = feature_set(feats, fs_name)
        X = (z_all if rep == "z" else raw_all)[mask].reset_index(drop=True)[cols]
        oof = meta.copy()
        oof["y_true"], oof["y_pred"] = y, pred
        if task == "brainrot":
            oof["p_brainrot"] = proba
        oof.to_csv(out / f"oof_{task}.csv", index=False, float_format="%.4g")
        imp = np.zeros(len(cols))
        n_f = 0
        scoring = "roc_auc" if task == "brainrot" else "balanced_accuracy"
        for test in A.folds(meta):
            train = ~test
            if len(np.unique(y[train])) < 2 or len(np.unique(y[test])) < 2:
                continue
            m = make_model(model).fit(X[train], y[train])
            pi = permutation_importance(
                m, X[test], y[test], scoring=scoring, n_repeats=3, random_state=0, n_jobs=-1
            )
            imp += pi.importances_mean
            n_f += 1
        if n_f:
            (
                pd.DataFrame({"feature": cols, "importance": imp / n_f})
                .sort_values("importance", ascending=False)
                .to_csv(out / f"importance_{task}.csv", index=False, float_format="%.5g")
            )
        final = make_model(model).fit(X, y)
        joblib.dump(
            {
                "model": final,
                "features": cols,
                "representation": rep,
                "task": task,
                "config": label,
                "note": "representation z = features normalised by the person's baseline "
                "(use analyze.baseline_params + zscore)",
            },
            out / f"best_{task}.joblib",
        )

    mdf = pd.DataFrame(metrics)
    mdf.to_csv(out / "metrics.csv", index=False, float_format="%.4f")
    pd.DataFrame(subj_rows).to_csv(out / "per_subject.csv", index=False, float_format="%.4f")
    rep_lines = [
        f"# ML vs Brain Rot formula `{out.name}`",
        "",
        f"Sessions: {len(folders)} · people: {meta_all['subject'].nunique()} · CV: **{cvn}**",
        "",
    ]
    for task, metric in (("brainrot", "auc"), ("state", "balanced_acc")):
        t = mdf[mdf["task"] == task]
        if t.empty:
            continue
        t = t.sort_values(metric, ascending=False)
        second = "balanced_acc" if task == "brainrot" else "macro_f1"
        rep_lines += [
            f"## {task} ({metric}, higher = better)",
            "",
            f"| config | {metric} | {second} |",
            "|---|---|---|",
        ]
        rep_lines += [
            f"| {r.config} | {getattr(r, metric):.3f} | {getattr(r, second):.3f} |" for r in t.itertuples()
        ]
        if task in best:
            rep_lines += [
                "",
                f"Saved model (best with features = {C.ML_FINAL_FEATURES or 'any'}): "
                f"**{best[task]['config']}**",
                "",
            ]
    ps = pd.DataFrame(subj_rows)
    if not ps.empty and ps["subject"].nunique() >= 2:
        rep_lines += ["## Spread across people (best configs)", ""]
        for task, metric in (("brainrot", "auc"), ("state", "balanced_acc")):
            if task in best:
                g = ps[(ps["task"] == task) & (ps["config"] == best[task]["config"])]
                rep_lines += [
                    f"- {task}: " + ", ".join(f"{r.subject} {getattr(r, metric):.2f}" for r in g.itertuples())
                ]
    rep_lines += [
        "",
        "How to read: `z` rows use the per-person baseline (fixation cross), `raw` rows do not. "
        "`face` rows are camera-only (no headset). If ML is not clearly better than the FORMULA under "
        "leave-one-subject-out, keep the formula – it is simpler and explainable.",
    ]
    (out / "comparison.md").write_text("\n".join(rep_lines))
    _plot(out, mdf)
    print("\n".join(rep_lines))
    print(f"\n-> {out}")


def _plot(out: Path, mdf: pd.DataFrame) -> None:
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        return
    tasks = [(t, m) for t, m in (("brainrot", "auc"), ("state", "balanced_acc")) if (mdf["task"] == t).any()]
    fig, axes = plt.subplots(
        1, len(tasks), figsize=(7 * len(tasks), 0.32 * len(mdf) / max(len(tasks), 1) + 2)
    )
    for ax, (task, metric) in zip(np.atleast_1d(axes), tasks, strict=False):
        t = mdf[mdf["task"] == task].sort_values(metric)
        colors = ["#d9822b" if ("FORMULA" in c or "NAIVE" in c) else "#4a7fc1" for c in t["config"]]
        ax.barh(t["config"], t[metric], color=colors)
        ax.set(title=f"{task}: {metric} (orange = formula / reference)", xlim=(0, 1))
        ax.tick_params(axis="y", labelsize=7)
    fig.tight_layout()
    fig.savefig(out / "comparison.png", dpi=120)
    plt.close(fig)


if __name__ == "__main__":
    main()
