# data_acc

Data collection and modelling for the Brain Rot project. We record EEG from a BrainAccess headset together
with webcam face features (MediaPipe) while a person goes through a fixed protocol, then turn those
recordings into features, a hand-made Brain Rot Index (BRI) formula and a few ML models. The live model
built here is what the backend uses in the app.

## Setup

```bash
cd data_acc
uv sync
```

By default the headset should be connected in BrainAccess Board, and we read it over LSL. To talk to the
headset directly through the SDK instead, pass `--eeg direct` (disconnect it in Board first). On macOS the
terminal needs camera access (and Bluetooth for direct mode). The MediaPipe model downloads itself into
`assets/` on the first run.

## Running it

```bash
uv run python main.py --subject tomek   # record one person, repeat for everyone
uv run python process.py                # sync and clean all new sessions
uv run python analyze.py                # baseline stats, weights and the BRI formula
uv run python train_ml.py               # ML models compared against the formula
uv run python train_nn.py               # small PyTorch net, exported to ONNX for the web
uv run python export_live.py            # package the live model for the backend
uv run python brainrot.py <session>     # optional, BRI over time for one session
```

Quick test without the headset: `uv run python main.py --subject test --no-eeg --short --windowed`.

All tunable values (phase lengths, contact thresholds, window sizes, which model goes live) live in
`config.py`.

## Protocol

`main.py` first shows a setup screen and waits until all electrodes are green (good contact, signal not flat
or saturated) for a couple of seconds. After 30 s you can press `s` to start anyway. Then the phases run in
order:

- `baseline`, 60 s looking at a fixation cross. This is the calm reference every person is compared against.
- `look_around`, 45 s of looking around the room.
- `mental_effort`, 60 s of counting down from 1000 by 7.
- `calm_video`, 120 s of calm clips from `../dataset_videos` (played with ffplay if it's installed).
- `insta_prep`, 10 s to open Instagram Reels in another tab. Not used for stats.
- `instagram`, 300 s of scrolling Reels. EEG and camera keep recording, a sound marks the end.

`q` aborts (what was recorded so far is kept), `n` skips to the next phase. EEG and camera timestamps are
epoch ms from the same clock.

## Artifacts

Every script writes only into its own folder and never touches the output of an earlier step. `analyze.py`,
`train_ml.py`, `train_nn.py` and `export_live.py` create a new timestamped folder on each run, so results from
different days can be compared.

```text
artifacts/
  1_sessions/<date>_<subject>/   main.py         eeg_raw.csv, face.csv, video.mp4, events.csv, meta.json
  2_processed/<session>/         process.py      synced.csv, features.csv, processing.json
  3_weights/<time>/              analyze.py      brainrot_model.json, report.md, stats, plots
  4_ml/<time>/                   train_ml.py     comparison.md, metrics.csv, per_subject.csv, best_*.joblib
  5_predictions/<session>/       brainrot.py     brainrot_timeline.csv
  6_nn/<time>/                   train_nn.py     brainrot_nn.onnx, nn_meta.json, report.md
  7_live/live_model.joblib       export_live.py  the model the backend loads
```

`process.py` puts EEG and face data on one 250 Hz grid (EEG filtered 1 to 40 Hz with a 50 Hz notch, short
gaps interpolated, longer ones left as NaN with a flag) and then computes features over 2 s windows every
0.5 s: EEG band powers and ratios, blinks, PERCLOS, gaze and head movement, brow furrow, blendshapes, plus
noise flags.

## The formula and the models

Everything is relative to the person's own baseline, since raw EEG values differ a lot between people.
Each feature becomes a z-score against the fixation cross (the first 15 s of the recording are dropped).
`analyze.py` picks weights from the Instagram vs calm contrast, computes `S = sum(w * z)` and maps it through
a sigmoid so that a typical baseline lands at BRI 25 and typical Instagram scrolling at 75.

`train_ml.py` and `train_nn.py` use the same windows and the same leave-one-subject-out folds, so their
numbers can be compared directly with the formula. If a model isn't clearly better on unseen people, the
formula is the simpler choice.

## How the live model reaches the backend

`export_live.py` trains the model chosen in `config.py` (gradient boosting on EEG and camera features, z
normalised) and saves it with its BRI calibration to `artifacts/7_live/live_model.joblib`. The backend
(`backend/app/brainrot/`) loads that file on startup and computes features live with the same functions from
`process.py` and `face_tracker.py`, using EEG from the headset and face landmarks sent by the browser over
`/ws/brainrot`. It builds the baseline from the fixation cross and smooths the output (see
`backend/app/brainrot/tuning.py`). After changing the model, run `export_live.py` again and restart the
backend.
