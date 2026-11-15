# PyTorch MLP with a brain rot head and a state head, exported to ONNX for the web (artifacts/6_nn/<time>/)
from __future__ import annotations

import argparse
import copy
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sklearn.metrics import balanced_accuracy_score, roc_auc_score
from torch import nn

import analyze as A
import config as C
import train_ml as T

SEED = 0
HIDDEN = (64, 32)
DROPOUT = 0.5
LR = 5e-4
WEIGHT_DECAY = 1e-3
BATCH = 256
MAX_EPOCHS = 150
MIN_EPOCHS = 5
PATIENCE = 20
NOISE_STD = 0.3  # augmentation, Gaussian noise on z
FEATURE_DROP = 0.1  # augmentation, share of features dropped to 0 (missing)
STATE_LOSS_WEIGHT = 0.5


class BrainRotNet(nn.Module):
    def __init__(self, n_in: int, n_states: int, z_clip: float = A.Z_CLIP) -> None:
        super().__init__()
        layers, d = [], n_in
        for h in HIDDEN:
            layers += [nn.Linear(d, h), nn.GELU(), nn.Dropout(DROPOUT)]
            d = h
        self.body = nn.Sequential(*layers)
        self.rot = nn.Linear(d, 1)
        self.state = nn.Linear(d, n_states)
        self.z_clip = z_clip

    def forward(self, z: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        z = torch.where(torch.isnan(z), torch.zeros_like(z), z).clamp(
            -self.z_clip, self.z_clip
        )  # NaN means missing, treated as baseline
        h = self.body(z)
        return self.rot(h).squeeze(-1), self.state(h)


# what goes into ONNX: z in, bri (0..100), p_brainrot and state_probs out
class ExportWrapper(nn.Module):
    def __init__(self, net: BrainRotNet, s_mid: float, s_scale: float) -> None:
        super().__init__()
        self.net = net
        self.register_buffer("s_mid", torch.tensor(float(s_mid)))
        self.register_buffer("s_scale", torch.tensor(float(s_scale)))

    def forward(self, z: torch.Tensor):
        logit, state_logits = self.net(z)
        bri = (100 * torch.sigmoid((logit - self.s_mid) / self.s_scale)).clamp(0, 100)
        return bri, torch.sigmoid(logit), torch.softmax(state_logits, dim=-1)


def _batches(n: int, rng: np.random.Generator):
    idx = rng.permutation(n)
    for a in range(0, n, BATCH):
        yield idx[a : a + BATCH]


def fit(
    X: np.ndarray,
    y_rot: np.ndarray,
    y_state: np.ndarray,
    n_states: int,
    val: tuple[np.ndarray, np.ndarray, np.ndarray] | None,
    epochs: int | None = None,
):
    torch.manual_seed(SEED)
    rng = np.random.default_rng(SEED)
    net = BrainRotNet(X.shape[1], n_states)
    opt = torch.optim.AdamW(net.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    pos_w = torch.tensor((1 - y_rot.mean()) / max(y_rot.mean(), 1e-3), dtype=torch.float32)
    counts = np.bincount(y_state, minlength=n_states).astype(float)
    cls_w = torch.tensor(counts.sum() / (n_states * np.maximum(counts, 1)), dtype=torch.float32)
    bce = nn.BCEWithLogitsLoss(pos_weight=pos_w)
    ce = nn.CrossEntropyLoss(weight=cls_w)
    Xt = torch.tensor(np.nan_to_num(X, nan=0.0), dtype=torch.float32)
    yr, ys = torch.tensor(y_rot, dtype=torch.float32), torch.tensor(y_state)
    best, best_score, best_ep, wait, curve = None, -np.inf, 0, 0, []
    for ep in range(epochs or MAX_EPOCHS):
        net.train()
        tot = 0.0
        for b in _batches(len(Xt), rng):
            xb = Xt[b] + NOISE_STD * torch.randn_like(Xt[b])
            xb = xb * (torch.rand_like(xb) > FEATURE_DROP)
            lr_, ls_ = net(xb)
            loss = bce(lr_, yr[b]) + STATE_LOSS_WEIGHT * ce(ls_, ys[b])
            opt.zero_grad()
            loss.backward()
            opt.step()
            tot += loss.item() * len(b)
        rec = {"epoch": ep + 1, "train_loss": tot / len(Xt)}
        if val is not None:
            net.eval()
            with torch.no_grad():
                vx = torch.tensor(np.nan_to_num(val[0], nan=0.0), dtype=torch.float32)
                vr, vs = net(vx)
                vl = (
                    bce(vr, torch.tensor(val[1], dtype=torch.float32))
                    + STATE_LOSS_WEIGHT * ce(vs, torch.tensor(val[2]))
                ).item()
            rec["val_loss"] = vl
            vy = val[1]
            # early stopping on Instagram vs everything else for unseen people
            score = roc_auc_score(vy, vr.numpy()) if len(np.unique(vy)) == 2 else -vl
            rec["val_auc"] = score
            if ep + 1 >= MIN_EPOCHS and score > best_score + 1e-4:
                best, best_score, best_ep, wait = copy.deepcopy(net.state_dict()), score, ep + 1, 0
            elif ep + 1 >= MIN_EPOCHS:
                wait += 1
                if wait >= PATIENCE:
                    curve.append(rec)
                    break
        curve.append(rec)
    if best is not None:
        net.load_state_dict(best)
    net.eval()
    return net, best_ep or (epochs or MAX_EPOCHS), curve


def predict(net: BrainRotNet, X: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    with torch.no_grad():
        lr_, ls_ = net(torch.tensor(X, dtype=torch.float32))
    return lr_.numpy(), torch.softmax(ls_, dim=-1).numpy()


def main() -> None:  # noqa: C901, PLR0915
    ap = argparse.ArgumentParser()
    ap.add_argument("folders", nargs="*", help="processed sessions (default: all in artifacts/2_processed)")
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()
    folders = A.resolve_processed(args.folders)
    meta, z, _raw, feats = T.load_all(folders)
    order = [p["id"] for p in C.PHASES]
    states = [p for p in order if p in set(meta["phase"])]
    keep = meta["phase"].isin(states).to_numpy()
    meta, z = meta[keep].reset_index(drop=True), z[keep].reset_index(drop=True)
    X = z[feats].to_numpy(np.float32)
    phase = meta["phase"].to_numpy()
    y_rot = (phase == C.BRAINROT_PHASE).astype(np.float32)
    y_state = np.array([states.index(p) for p in phase])
    calm = np.isin(phase, [C.BRAINROT_PHASE, *C.CALM_PHASES])
    out = args.out or C.ARTIFACTS / "6_nn" / time.strftime("%Y-%m-%d_%H-%M-%S")
    out.mkdir(parents=True, exist_ok=True)
    cvn = A.cv_name(meta)
    print(
        f"{len(folders)} sessions, {meta['subject'].nunique()} people, {len(feats)} features, "
        f"{len(X)} windows, CV: {cvn}"
    )

    oof_logit = np.full(len(X), np.nan)
    oof_state = np.full((len(X), len(states)), np.nan)
    best_epochs, curves = [], []
    subjects = meta["subject"].to_numpy()
    for k, test in enumerate(A.folds(meta)):
        train = ~test
        tr_subj = pd.unique(subjects[train])
        rng = np.random.default_rng(SEED + k)
        # inner validation on 1-2 training subjects, never the test one
        if len(tr_subj) >= 3:
            v_subj = rng.choice(tr_subj, size=2 if len(tr_subj) >= 5 else 1, replace=False)
            inner_val = train & np.isin(subjects, v_subj)
            inner_tr = train & ~inner_val
        else:
            # too few people, use the last 20 % of the training windows
            idx = np.flatnonzero(train)
            inner_val = np.zeros(len(X), bool)
            inner_val[idx[int(0.8 * len(idx)) :]] = True
            inner_tr = train & ~inner_val
        net, ep, curve = fit(
            X[inner_tr],
            y_rot[inner_tr],
            y_state[inner_tr],
            len(states),
            (X[inner_val], y_rot[inner_val], y_state[inner_val]),
        )
        oof_logit[test], oof_state[test] = predict(net, X[test])
        best_epochs.append(ep)
        curves.append(curve)
        name = pd.unique(subjects[test])
        print(f"  fold {k + 1}: test {', '.join(map(str, name))[:40]:40s} best epoch {ep}")

    p = 1 / (1 + np.exp(-oof_logit))
    state_pred = np.array(states)[np.nanargmax(np.nan_to_num(oof_state, nan=-1), axis=1)]
    metrics = {
        "cv": cvn,
        "auc_instagram_vs_calm": float(roc_auc_score(y_rot[calm], p[calm])),
        "auc_instagram_vs_all": float(roc_auc_score(y_rot, p)),
        "state_balanced_acc": float(balanced_accuracy_score(phase, state_pred)),
        "best_epochs": best_epochs,
    }
    per = []
    for s in pd.unique(subjects):
        m = subjects == s
        mc = m & calm
        per.append(
            {
                "subject": s,
                "auc_vs_calm": roc_auc_score(y_rot[mc], p[mc]) if len(np.unique(y_rot[mc])) == 2 else np.nan,
                "auc_vs_all": roc_auc_score(y_rot[m], p[m]) if len(np.unique(y_rot[m])) == 2 else np.nan,
                "state_balanced_acc": balanced_accuracy_score(phase[m], state_pred[m]),
            }
        )
    per_df = pd.DataFrame(per)
    per_df.to_csv(out / "per_subject.csv", index=False, float_format="%.4f")

    # calibrate on out-of-fold logits, i.e. how a new person looks
    cal = A.calibrate(
        float(np.nanmedian(oof_logit[phase == C.BASELINE_PHASE])),
        float(np.nanmedian(oof_logit[phase == C.BRAINROT_PHASE])),
    )
    bri_oof = np.clip(100 / (1 + np.exp(-(oof_logit - cal["s_mid"]) / cal["s_scale"])), 0, 100)
    oof = meta.copy()
    oof["p_brainrot"], oof["bri"], oof["state_pred"] = p, bri_oof, state_pred
    oof.to_csv(out / "oof.csv", index=False, float_format="%.4g")

    n_ep = int(np.median(best_epochs))
    final, _, final_curve = fit(X, y_rot, y_state, len(states), None, epochs=n_ep)
    wrapper = ExportWrapper(final, cal["s_mid"], cal["s_scale"]).eval()
    onnx_path = out / "brainrot_nn.onnx"
    dummy = torch.zeros(1, len(feats))
    torch.onnx.export(
        wrapper,
        (dummy,),
        str(onnx_path),
        input_names=["z"],
        output_names=["bri", "p_brainrot", "state_probs"],
        dynamic_axes={
            "z": {0: "batch"},
            "bri": {0: "batch"},
            "p_brainrot": {0: "batch"},
            "state_probs": {0: "batch"},
        },
        opset_version=17,
        dynamo=False,
    )

    import onnxruntime as ort

    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    probe = X[: min(500, len(X))].copy()
    probe[::7, ::5] = np.nan  # check NaN handling matches torch too
    o_bri, o_p, o_s = sess.run(None, {"z": probe.astype(np.float32)})
    with torch.no_grad():
        t_bri, t_p, t_s = (v.numpy() for v in wrapper(torch.tensor(probe)))
    diff = float(max(np.abs(o_bri - t_bri).max(), np.abs(o_p - t_p).max(), np.abs(o_s - t_s).max()))
    metrics["onnx_max_abs_diff_vs_torch"] = diff
    (out / "metrics.json").write_text(json.dumps(metrics, indent=2))

    weights_model = C.WEIGHTS_DIR / "brainrot_model.json"
    default_baseline = (
        json.loads(weights_model.read_text()).get("default_baseline", {}) if weights_model.exists() else {}
    )
    nn_meta = {
        "version": out.name,
        "onnx": onnx_path.name,
        "input": "z",
        "features": feats,
        "z_definition": "z = (x' - baseline_mean) / baseline_std, x' = log(x) for log_features; "
        "baseline = fixation cross windows after the first "
        f"{C.SKIP_SESSION_START_S:.0f} s; missing feature -> NaN (the network treats it as 0)",
        "log_features": sorted(A.LOG_FEATURES),
        "z_clip": A.Z_CLIP,
        "states": states,
        "outputs": {
            "bri": "0..100, baseline ≈ 25, typical Instagram ≈ 75",
            "p_brainrot": "probability of Instagram-like scrolling",
            "state_probs": states,
        },
        "calibration": cal,
        "metrics": metrics,
        "sessions": [f.name for f in folders],
        "subjects": sorted(map(str, pd.unique(subjects))),
        "default_baseline": {f: default_baseline[f] for f in feats if f in default_baseline},
        "window_s": C.WINDOW_S,
        "step_s": C.STEP_S,
    }
    (out / "nn_meta.json").write_text(json.dumps(nn_meta, indent=1, default=float))

    lines = [
        f"# Neural network `{out.name}`",
        "",
        f"Sessions {len(folders)} · people {meta['subject'].nunique()} · "
        f"features {len(feats)} (EEG + face) · CV: **{cvn}**",
        "",
        "| model | AUC Instagram vs calm | AUC Instagram vs all | state balanced acc |",
        "|---|---|---|---|",
        f"| **neural net (this)** | {metrics['auc_instagram_vs_calm']:.3f} | {metrics['auc_instagram_vs_all']:.3f} "
        f"| {metrics['state_balanced_acc']:.3f} |",
    ]
    if weights_model.exists():
        wm = json.loads(weights_model.read_text())
        for m, v in (wm.get("cv_auc") or {}).items():
            lines.append(f"| formula ({m} weights) | {v:.3f} | – | – |")
    ml_runs = sorted((C.ML_DIR).glob("*/metrics.csv")) if C.ML_DIR.exists() else []
    if ml_runs:
        mdf = pd.read_csv(ml_runs[-1])
        for task, col in (("brainrot", "auc"), ("state", "balanced_acc")):
            t = mdf[(mdf["task"] == task) & ~mdf["config"].str.contains("FORMULA|NAIVE")]
            if not t.empty and col in t:
                r = t.sort_values(col, ascending=False).iloc[0]
                cell = f"{r[col]:.3f}"
                lines.append(
                    f"| best ML `{r['config']}` | {cell if task == 'brainrot' else '–'} | – | "
                    f"{cell if task == 'state' else '–'} |"
                )
    lines += [
        "",
        f"Final model: {n_ep} epochs on all data. BRI calibration (out-of-fold): "
        f"BRI = 100·sigmoid((logit − {cal['s_mid']:.3f}) / {cal['s_scale']:.3f}).",
        f"ONNX vs PyTorch max abs difference: {diff:.2e}.",
        "",
        "## Per person",
        "",
        "```",
        per_df.round(3).to_string(index=False),
        "```",
        "",
        "## BRI per phase (out-of-fold = people the network did not see)",
        "",
        "```",
        oof.groupby("phase")["bri"].median().round(1).to_string(),
        "```",
        "",
        "Web: compute the features of `nn_meta.json → features` in that order, z-normalise with the person's "
        "fixation-cross baseline, run `brainrot_nn.onnx` (onnxruntime-web), read `bri`.",
    ]
    (out / "report.md").write_text("\n".join(lines))
    _plot(out, curves, final_curve)
    print("\n".join(lines))
    print(f"\n-> {out}")


def _plot(out: Path, curves: list, final_curve: list) -> None:
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        return
    fig, ax = plt.subplots(figsize=(8, 4))
    for i, c in enumerate(curves):
        d = pd.DataFrame(c)
        if "val_auc" in d:
            ax.plot(
                d["epoch"], d["val_auc"], lw=0.8, alpha=0.6, label=f"fold {i + 1} val AUC" if i < 3 else None
            )
    ax.set(xlabel="epoch", ylabel="validation AUC", title="Training (val = held-out people inside each fold)")
    ax.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(out / "training.png", dpi=120)
    plt.close(fig)


if __name__ == "__main__":
    main()
