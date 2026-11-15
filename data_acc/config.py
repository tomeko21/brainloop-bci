# tuning knobs for recording, processing and the models, shared by every script here
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VIDEOS_DIR = ROOT.parent / "dataset_videos"
ASSETS_DIR = ROOT / "assets"  # MediaPipe model is downloaded here
# each script writes only to its own numbered folder, inputs stay untouched
ARTIFACTS = Path(os.environ.get("DATA_ACC_ARTIFACTS", ROOT / "artifacts"))
SESSIONS_DIR = ARTIFACTS / "1_sessions"  # main.py
PROCESSED_DIR = ARTIFACTS / "2_processed"  # process.py
WEIGHTS_DIR = ARTIFACTS / "3_weights"  # analyze.py
ML_DIR = ARTIFACTS / "4_ml"  # train_ml.py
PREDICTIONS_DIR = ARTIFACTS / "5_predictions"  # brainrot.py

EEG_MODE = "board"  # board = LSL stream from BrainAccess Board, direct = SDK (disconnect in Board first)
EEG_DEVICE = ""  # e.g. "BA MINI 074", empty takes the first headset found
EEG_CHANNEL_NAMES = [
    "F3",
    "F4",
    "C3",
    "C4",
    "P3",
    "P4",
    "O1",
    "O2",
]  # BA MINI order, same as backend/app/config.py

# contact check ("red LED"), same rules as backend/app/eeg/tuning.py
PTP_WINDOW_S = 1.0
PTP_FLAT_UV = 0.5  # µV, below this the channel is flat / not streaming
PTP_MAX_GOOD_UV = 250.0  # µV, above this it's movement or no skin contact
RAIL_UV = 562_500.0  # µV, amplifier rail at gain x8
SATURATED_FRACTION = 0.2
BANDPASS_HZ = (1.0, 40.0)
NOTCH_HZ = 50.0
REQUIRED_GOOD_CHANNELS = 8  # green electrodes needed before the protocol starts
GOOD_CONTACT_HOLD_S = 2.0
ALLOW_FORCE_START_AFTER_S = 30.0  # after this "s" starts anyway

CAMERA_INDEX = 0
CAMERA_WIDTH = 1280
CAMERA_HEIGHT = 720
CAMERA_FPS = 30
SAVE_VIDEO = True  # video.mp4 next to face.csv, linked by frame_idx
FACE_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/"
    "face_landmarker.task"
)
FACE_MODEL_PATH = ASSETS_DIR / "face_landmarker.task"
EAR_CLOSED = 0.20  # eye aspect ratio below this counts as closed (blinks, PERCLOS)

# session order. kind: cross, text, video (calm clips from VIDEOS_DIR) or external (Instagram)
PHASES: list[dict] = [
    {
        "id": "baseline",
        "kind": "cross",
        "seconds": 60,
        "title": "BASELINE",
        "text": "Patrz na krzyzyk przez 1 minute i skup sie na nim. Nie ruszaj glowa.",
    },
    {
        "id": "look_around",
        "kind": "text",
        "seconds": 45,
        "title": "ROZGLADAJ SIE",
        "text": "Teraz swobodnie rozgladaj sie po pokoju. Ruszaj oczami, nie glowa.",
    },
    {
        "id": "mental_effort",
        "kind": "text",
        "seconds": 60,
        "title": "MYSL INTENSYWNIE",
        "text": "Odejmuj w pamieci 7 od 1000: 993, 986, 979 ... Skup sie maksymalnie.",
    },
    {
        "id": "calm_video",
        "kind": "video",
        "seconds": 120,
        "title": "SPOKOJNY FILM",
        "text": "Teraz spokojnie ogladaj film.",
        "video_dirs": ["slow_nature", "calm_science", "silent_cooking"],
    },
    {
        "id": "insta_prep",
        "kind": "text",
        "seconds": 10,
        "title": "ODPAL INSTAGRAMA",
        "text": "Masz 10 s na odpalenie Instagram Reels w innej karcie. Nie zdejmuj opaski.",
    },
    {
        "id": "instagram",
        "kind": "external",
        "seconds": 300,
        "title": "SCROLLUJ INSTAGRAMA",
        "text": "Scrolluj Instagram Reels normalnie. Uslyszysz dzwiek gdy koniec.",
    },
]
PHASE_SETTLE_S = 3.0  # start of each phase skipped in stats, person is still switching
SKIP_SESSION_START_S = 15.0  # electrodes and filters settle, falls inside the baseline cross
IGNORED_PHASES = {"insta_prep", "setup"}
INTRO_SECONDS = 4  # "Za chwile" screen before each phase, not recorded as a phase

SYNC_HZ = 250  # synced.csv grid, native EEG rate
MAX_INTERP_GAP_MS = 120  # longer gaps stay NaN with a gap flag
WINDOW_S = 2.0  # feature window length and step, s
STEP_S = 0.5
EEG_BANDS = {
    "delta": (1.0, 4.0),
    "theta": (4.0, 8.0),
    "alpha": (8.0, 13.0),
    "beta": (13.0, 30.0),
    "gamma": (30.0, 40.0),
}
REL_TOTAL = (1.0, 40.0)
SPIKE_SIGMA = 6.0  # robust sigmas from the median, blinks / jaw clench
WINDOW_MAX_PTP_UV = 200.0  # µV per channel per window
ACCEL_MOTION_G = 0.08  # accelerometer std in g, above means head movement
MIN_GOOD_CHANNELS = 4
FEATURE_OUTLIER_Z = 4.0  # robust z within a phase, flagged as possible noise

BASELINE_PHASE = "baseline"
# live model packaged by export_live.py for the backend, same pick as train_ml
LIVE_MODEL = "grad_boost"
LIVE_FEATURES = "all"
LIVE_NEGATIVE = "all"  # "all" also teaches look_around / mental_effort as not brain rot, or use CALM_PHASES
LIVE_DIR = ARTIFACTS / "7_live"
ML_FINAL_FEATURES = "all"  # feature set for best_<task>.joblib, None = whatever scores best
BRAINROT_PHASE = "instagram"
CALM_PHASES = ["baseline", "calm_video"]  # negative class of the brain rot contrast
MIN_ABS_EFFECT = 0.3  # |Cohen's d| below this gets weight 0
MAX_EFFECT_FOR_WEIGHT = 3.0
BRI_AT_BASELINE = 25.0  # backend scale, 25 = calm
BRI_AT_BRAINROT = 75.0  # typical Instagram in the training data
# sensitive BRI reacts earlier, "more alert than baseline" counts only half
BRI_SENSITIVE_AT_BASELINE = 35.0
BRI_SENSITIVE_AT_BRAINROT = 90.0
SENSITIVE_NEGATIVE_FACTOR = 0.5
