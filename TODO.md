# TODO – what is not done yet

There are **no mocks** in the project. Everything below is simply *not implemented*: the app runs without it
and shows "not trained" / "no data" where these pieces will plug in. In the code these places are marked with
`TODO(team)` (`grep -rn "TODO(team)" backend/app frontend/src`).

## Status at a glance

| Part | Status |
| --- | --- |
| Reels feed (your `videos` table + `dataset_videos/`), likes, sessions, `data/` export | ✅ working |
| EEG headset (BrainAccess Board stream or direct SDK), PTP, contact, bands, **BRI from EEG** | ✅ working (thresholds need validation – §3) |
| Raw EEG recording per session (`eeg_raw.csv`) | ✅ working |
| Face tracking in the browser (MediaPipe: eyes, blinks, PERCLOS, gaze, yawn, head pose, 14 landmarks) | ✅ working – data is collected (`face.csv`) |
| Camera frames → backend (OpenCV: face present, motion, brightness, forehead RGB) | ✅ working – data is collected |
| Calm filter, reel selection | ✅ working – driven by the **EEG BRI** until §1 exists |
| **BRI from the camera** (fatigue without the headset) | ❌ **not implemented** – §1 |
| **Heart rate (rPPG)** from forehead colour | ❌ **not implemented** – §2 |

---

## 1. Camera BRI model (fatigue without the EEG headset) – main missing piece

**Goal:** predict the EEG BRI (0..100) from camera + scroll features only, so the app works without the headset.

### 1a. Inference – implement `CameraBriModel.predict`

File: `backend/app/ml/predictor.py` (currently returns `None`).

```python
class CameraBriModel:
    version: str  # e.g. "lgbm-2026-11-15" (shown in the admin panel, stored with every window)

    def predict(self, window: MlFeatureWindow, video: VideoFeatures | None) -> float | None:
        """BRI 0..100 for the last 10 s, or None if the model cannot predict (e.g. no face)."""
```

**Input `window: MlFeatureWindow`** (`backend/app/schemas.py`, built in the browser in
`frontend/src/features/ml/buildFeatureWindow.ts`, every 2 s over the last 10 s; `None` = not available):

| Field | Meaning | Unit / range |
| --- | --- | --- |
| `face_present_ratio` | share of frames with a face | 0..1 |
| `ear_mean` | mean eye aspect ratio (openness) | ~0.15 closed … 0.35 open |
| `blink_rate_per_min` | blinks per minute (last 60 s) | /min |
| `perclos` | share of time with closed eyes (last 60 s) | 0..1 |
| `head_pitch_mean` | head nodding (+ = down) | degrees |
| `head_motion` | std of nose position (low = frozen) | normalized image units |
| `jaw_open_max` | max mouth opening (yawning) | 0..1 (MediaPipe blendshape) |
| `scroll_speed_mean` | mean scroll speed | reels / s |
| `scroll_samples` | how many scroll samples in the window | count |
| `dwell_mean_sec` | mean time on the last 5 reels | s |
| `watch_pct_mean` | mean % of the last 5 reels watched | % (>100 = looped) |
| `likes_in_window` | likes in the window | count |

**Input `video: VideoFeatures | None`** (server OpenCV analysis of camera frames, `backend/app/ml/video_features.py`):
`frames`, `face_present_ratio` (0..1), `brightness` (0..255), `motion` (0..255), `face_area` (0..1),
`forehead_rgb` (r, g, b), `window_start_ms`, `window_end_ms`.

**Output:** `float` BRI 0..100 (same scale as the EEG BRI: 25 = the person's calm baseline, ≥ 70 = "stop
scrolling"), or `None`. The endpoint `POST /api/ml/predict-window` already wraps it into `MlPrediction`
(`bri`, `briEeg`, `shouldStop`, `modelVersion`, `topFactors`) – optionally also fill `topFactors`
(`list[MlFactor(feature: str, contribution: float)]`, e.g. from feature importances / SHAP).

### 1b. Training – new script `backend/app/ml/train.py`

```python
def build_training_set(dataset_dir: Path = Path("../data/dataset")) -> pd.DataFrame:
    """ml_windows.csv joined with session.csv (subject_name per session_id).
    Rows WITHOUT bri_eeg are dropped (no label). Returns features + 'bri_eeg' + 'subject_name'."""

def train_camera_model(df: pd.DataFrame) -> TrainResult:
    """Regressor (e.g. LightGBM) features -> bri_eeg. Validation: Leave-One-Subject-Out.
    Returns TrainResult(artifact_path: Path, mae_loso: float, feature_importance: dict[str, float])."""
```

- **Data that already exists:** `data/dataset/ml_windows.csv` (features + `bri_ai` + **`bri_eeg` label**),
  Postgres table `windows` (same + `video_features`), `data/dataset/session.csv` (subject per session).
  Raw sources if you want other features: `face.csv` (10 Hz), `scroll.csv`, `reel_views.csv`, `eeg_raw.csv`.
- Save the artifact to `data/models/` and register it in the Postgres table `models`
  (`artifact_path`, `accuracy_loso`, `is_active=True`); load the active one in `CameraBriModel.__init__`.
- Features used in training must be **exactly** the ones built at inference (§1a). If you change them, change
  `buildFeatureWindow.ts`, `MlFeatureWindow` (frontend `types/domain/ml.ts` + backend `schemas.py`) and the
  `ml_windows` columns together.

## 2. Heart rate from the camera (rPPG)

New file `backend/app/ml/rppg.py` (a POS-method prototype is in the project architecture doc, §7):

```python
def estimate_bpm(rgb: np.ndarray, fs: float) -> float | None:
    """rgb: (N, 3) mean forehead R, G, B per frame, evenly sampled at fs Hz (≥ 5 s of data).
    Returns heart rate in beats per minute (45..170), or None if the signal is too short/noisy."""
```

- **Input already collected:** `face.csv` columns `forehead_r`, `forehead_g`, `forehead_b` at 10 Hz (`fs = 10`)
  – 10 Hz is the minimum; raise `TRACKING.faceSampleHz` in `frontend/src/config/tuning.ts` to 15–30 for
  better accuracy. (Server frames are only 2 fps – too slow for rPPG.)
- To use it live: compute BPM in the browser window builder or on the backend from a 10 s buffer, add
  `bpm: float | None` to `MlFeatureWindow` (and `FaceLiveSummary` to show it in the admin panel).

## 3. Validate the EEG thresholds on real recordings

The EEG pipeline works, but its constants are first reasonable defaults – `backend/app/eeg/tuning.py`:
`PTP_MAX_GOOD_UV` (250 µV), `MIN_GOOD_CHANNELS` (3), `SPIKE_SIGMA` (6, blink rejection), `BASELINE_SECONDS` (30,
fixation cross), `BASELINE_BRI` (25), `RATIO_FOR_FULL` (4×), `BRI_MEDIAN_S` / `BRI_TAU_S` / `BRI_MAX_RATE_PER_S`.
The BRI scale (25 = rest, 100 = ratio 4× rest) is our own design choice, not a published scale. Check them on `eeg_raw.csv` of a few people
(focused reading vs. mindless scrolling) and adjust. Calm filter thresholds: `frontend/src/config/tuning.ts`.

## 4. Nice to have

- **Learned reel ranking** – the selector (`backend/app/services/reel_selector.py`) is hand-weighted (`W`, `LEVEL`)
  on top of `engagement.py`; with enough sessions, learn the weights (input: candidate reels + engagement + BRI).
- **Multiple backend workers** – live state (heartbeats, last predictions) is in memory
  (`backend/app/services/live_state.py`); with more than one uvicorn worker move it to Redis.
