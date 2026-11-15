# BrainLoop backend

The API behind BrainLoop: a short-video feed that measures how "brain-rotted" you get while scrolling.
It serves the reels, stores session data, reads the BrainAccess EEG headset and computes a live
Brain Rot Index (BRI) from EEG plus the face data the browser sends.

Stack: FastAPI, async SQLAlchemy on a local PostgreSQL, numpy/scipy for the signal processing,
OpenCV for camera frames, and the model trained in `../data_acc` for the live BRI.

## What you need

- PostgreSQL running locally with an empty database called `db_brainloop_bci` (pgAdmin is fine).
- [uv](https://docs.astral.sh/uv/).
- The reels in `../dataset_videos/`: the category folders with mp4 files and `reels_metadata.csv`.
- Optional: `../data_acc` with `artifacts/7_live/live_model.joblib` for the live BRI. Without it the API
  still runs, the live BRI just reports itself as disabled.

## Running it

```bash
cd backend
cp .env.example .env   # set DB_PASSWORD, and the other DB_* values if your Postgres differs
uv sync
uv run api             # http://localhost:8000, Swagger at /docs
```

`uv run api` is a thin wrapper around uvicorn with auto-reload. Useful flags: `--port 8000`,
`--host 0.0.0.0` to expose it on the network, `--no-reload`.

On startup the app creates its tables if they are missing (no migrations, `create_all` only), adds any reels
from `reels_metadata.csv` that aren't in the `videos` table yet, and starts the EEG listener and the live
BRI loop. To sync reels without starting the server run `uv run seed`; `uv run seed --update` also
overwrites existing rows with the CSV values. Rows you edit in pgAdmin are otherwise left alone.

Then start the frontend in another terminal (`cd frontend && npm run dev`). Vite proxies `/api`,
`/media/videos` and `/ws` to port 8000, so the browser only talks to the frontend.

### On a phone

Run `npm run dev:mobile` in the frontend. It serves over HTTPS on your LAN (the camera needs HTTPS) and
proxies `/api` and `/ws` to the backend, so the backend can stay on `127.0.0.1`. Open the address Vite
prints on the phone and accept the self-signed certificate.

Lint and format: `uv run ruff check app && uv run ruff format app`.

## Where things live

```text
app/
  __main__.py      uv run api
  main.py          app factory, startup (tables, seed, EEG hub, live BRI), /media/videos
  config.py        settings from .env
  db.py, models.py, schemas.py, deps.py
  seed.py          reels_metadata.csv into the videos table
  routers/         feed, sessions, live (admin panel), users, eeg, brainrot, ml, health
  services/        reel selection, engagement heuristics, storage on disk, in-memory live state
  eeg/             headset input, signal processing, raw recorder, hub, tuning constants
  brainrot/        live BRI engine, the 0.5 s loop, tuning constants
  ml/              OpenCV frame features, camera-only model stub
```

The JSON API uses camelCase, matching `frontend/src/types`.

## Feed

`GET /api/feed?session_id=...&cursor=0&limit=5` returns reels in small batches. Paging is stable per
session: a position that was already served always returns the same reel. New positions are picked by
`services/reel_selector.py`, which behaves like a typical engagement-driven recommender. It escalates
stimulation when BRI rises or the viewer gets bored, leans on categories they watch and like, and avoids
repeats. The calm filter on the frontend is the counterweight and is deliberately separate. Every pick stores
a short reason in `reel_impressions.reason`, which helps when debugging the recommendations.

Videos are served from `VIDEOS_DIR` at `/media/videos/<filename>` with Range support.

## EEG headset

There are two ways to get data from the BrainAccess headset:

1. Through BrainAccess Board. Connect the headset in Board as usual; it publishes an LSL stream that the
   backend finds on its own. Only streams from this machine are used, so other teams' headsets on the same
   Wi-Fi are ignored (`EEG_LSL_ALLOW_REMOTE=true` changes that).
2. Directly from the app, without Board. "Find headsets" and "Connect" use the BrainAccess SDK in a child
   process (`eeg/direct_worker.py`), so a Bluetooth crash can't take down the API. The headset must not be
   connected in Board at the same time, and on macOS the backend has to be started from a terminal that
   has Bluetooth permission.

Either way the samples go through `eeg/processing.py`: band-pass and notch filtering, contact quality per
electrode, blink rejection and theta/alpha/beta band powers. From those it computes an EEG-only BRI relative
to the person's resting baseline, recorded during the fixation cross at the start of a session. Snapshots
are pushed to the admin panel over SSE (`/api/eeg/stream`) or WebSocket (`/ws/eeg/live`). During every
session the raw signal is also written to `data/sessions/<folder>/eeg_raw.csv`. All the numbers worth
tweaking are in `eeg/tuning.py`.

## Live Brain Rot Index

`brainrot/engine.py` combines both modalities into one indicator. The frontend opens `/ws/brainrot` and
streams raw MediaPipe face data (a few landmarks, blendshapes and the head pose matrix), while raw EEG
chunks arrive from the EEG source. Every 0.5 s the engine takes the last few seconds of both and builds a
2 s feature window using the feature code from `../data_acc` (the same functions that produced the
training data). It z-scores the window against the person's baseline and runs the exported model, then
smooths the result so it rises quickly and falls slowly. Missing modalities are fine: the model handles
missing features, and with no data at all the last value is held for a while before it goes to null.

The fixation cross calls `/api/brainrot/baseline/start` and `/finish` to record a personal baseline;
until then the engine uses the average baseline of the training subjects. Timing and smoothing constants
are in `brainrot/tuning.py`.

The older per-window endpoint `POST /api/ml/predict-window` is still there. It stores every feature
window together with the EEG BRI in the `windows` table as training data for a camera-only model, which is
not trained yet (`ml/predictor.py` returns `None`).

## Data on disk

Everything goes to `DATA_DIR` (default `../data`):

```text
data/
  sessions/<date>_<subject>_<session_id>/   CSVs from the browser, .webm recordings, eeg_raw.csv, frames/
  dataset/<table>.csv                        all sessions appended, each session at most once
```

Live state (heartbeats, recent events, latest predictions) is kept in memory, which is fine for a single
uvicorn process.
