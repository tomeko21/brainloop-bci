# BrainLoop – backend

FastAPI + SQLAlchemy (async) + PostgreSQL (local, e.g. managed in pgAdmin) + OpenCV.
**No mocks anywhere.** The frontend gets everything from here; EEG comes only from the real BrainAccess headset
(through BrainAccess Board or directly via the SDK). The camera-based BRI model is **not implemented yet** – it
returns nothing (`modelVersion: "not-trained"`) and the app uses the EEG BRI. What is left to build: [TODO.md](../TODO.md).

## Run

Prerequisites: local PostgreSQL with a database `db_brainloop_bci` (create it in pgAdmin),
[uv](https://docs.astral.sh/uv/), and the reels in `../dataset_videos/` (mp4 folders + `reels_metadata.csv`).

```bash
cd backend
cp .env.example .env          # fill DB_PASSWORD (and DB_* if your Postgres differs)
uv sync                       # creates .venv and installs dependencies
uv run api                    # start the API (auto-reloads on code changes)

# other terminal
cd frontend && npm run dev    # http://localhost:5173 – proxies /api, /media/videos, /ws to :8000
```

`uv run api` = our command that starts **uvicorn** – the web server that runs FastAPI apps
(like `npm run dev` for the frontend). Flags: `--port 8000`, `--host 0.0.0.0`, `--no-reload`.
`uv run seed` refreshes the reels table from the CSV without starting the server.

- API docs (Swagger): http://localhost:8000/docs
- Health: `GET /api/health` → DB, number of reels, model version
- Lint/format: `uv run ruff check app && uv run ruff format app`

On startup the app creates its own tables (`create_all`, no Alembic – hackathon rule; your `videos` table is
never altered), **adds reels from `../dataset_videos/reels_metadata.csv` that are missing in `videos`**
and starts the EEG hub.

## Folder layout

```text
backend/
├── pyproject.toml           # deps (uv) + ruff config
├── .env.example             # DB_*, DATA_DIR, VIDEOS_DIR, REELS_CSV, EEG_LSL_STREAM, CORS_ORIGINS
└── app/
    ├── __main__.py          # `uv run api` – starts uvicorn
    ├── main.py              # app factory, lifespan (tables, seed, EEG hub), /media/videos static files
    ├── config.py            # settings from .env (paths relative to backend/)
    ├── db.py                # async engine + get_db + create_tables
    ├── models.py            # ALL tables in one file
    ├── schemas.py           # ALL request/response models (camelCase JSON = frontend/src/types)
    ├── deps.py              # DbDep, get_session_or_404
    ├── seed.py              # CSV -> your `videos` table (adds missing rows; `--update` overwrites)
    ├── services/catalog.py  # reading `videos`: available reels (file exists), lookup by id
    ├── utils.py             # now_ms, stable_hash, slug
    ├── routers/
    │   ├── feed.py          # GET /api/feed (batches), POST /api/feed/{id}/like
    │   ├── sessions.py      # sessions, recording upload, CSV dataset, live camera frames, storage status
    │   ├── live.py          # heartbeats from the feed, live viewer + live events for the admin panel
    │   ├── users.py         # profile + stats computed from the DB
    │   ├── eeg.py           # EEG status, Board stream selection, direct scan/connect, SSE + WS live
    │   ├── ml.py            # POST /api/ml/predict-window (BRI from camera + scroll)
    │   └── health.py
    ├── services/
    │   ├── reel_selector.py # which reels to serve next (BRI-aware, category variety)
    │   ├── reels.py         # DB reel -> API reel
    │   ├── storage.py       # writing to data/ (session folders + aggregated dataset)
    │   └── live_state.py    # in-memory live state (heartbeats, frames analysis, predictions, events)
    ├── eeg/
    │   ├── eeg_source.py           # Board (LSL) listening + direct SDK mode: status, snapshots, recording
    │   ├── direct_worker.py        # BrainAccess SDK in child processes (scan / connect)
    │   ├── processing.py           # filters, PTP, contact, band powers, BRI
    │   ├── recorder.py             # raw EEG -> eeg_raw.csv
    │   ├── tuning.py               # all EEG constants
    │   └── hub.py                  # one reader -> many subscribers (SSE/WS clients)
    └── ml/
        ├── video_features.py # OpenCV analysis of camera frames (face, motion, brightness, forehead RGB)
        └── predictor.py      # camera BRI model – NOT trained yet (stub returning None, see TODO.md)
```

## Database (PostgreSQL, local)

| Table | What |
| ----- | ---- |
| `videos` | **your table** (created in pgAdmin, same columns as `reels_metadata.csv`, PK `filename`) – the backend only reads it and adds missing rows |
| `sessions` | one measurement session: subject name, start/end, folder in `data/sessions/`, video files |
| `reel_impressions` | which reel was served at which position of a session's feed (`stream` = `main`) + why |
| `likes` | per subject name |
| `reel_views` | imported from `reel_views.csv` at the end of a session (dwell, watch %, loops, exit scroll speed) |
| `events` | imported from `events.csv` |
| `windows` | every ~2 s: browser features + server video features + `bri_ai` + `bri_eeg` at the same moment → **training data** |
| `models` | trained model artifacts (empty until training exists) |

**Reels = your `videos` table.** Edit rows in pgAdmin – the backend never overwrites them.
New rows in `reels_metadata.csv` are added on start (or `uv run seed`); `uv run seed --update`
overwrites existing rows with the CSV. `filename` is relative to `VIDEOS_DIR`; the API id of a reel is
the file name without extension (`chaotic_memes_012`). Rows whose file is missing are simply not served.

## Feed – how reels are chosen

`GET /api/feed?session_id=…&cursor=0&limit=5`

- Reels come in **batches of 5** (`feed_default_batch`, max 20) – the frontend asks again only near the end.
- Paging is **stable**: positions already served to a session return the same reels (refetch = same feed).
  Pull-to-refresh on the frontend simply continues from a later cursor → new reels.
- `services/reel_selector.py`:
  1. no repeats within a session (after everything was seen, only the last 30 are excluded),
  2. target stimulation from the latest AI BRI: **BRI ≥ 70 → calm reels**, BRI 40–70 → medium, else a mix
     (the frontend calm filter does not change which reels are served – it softens playback),
  3. random jitter + penalty for repeating categories → variety.
  The reason is stored in `reel_impressions.reason` (e.g. `bri=74>=70`).

Videos are served from `VIDEOS_DIR` at `/media/videos/<filename>` (HTTP Range supported → seeking works).

## Camera frames (live)

While the camera records, the frontend sends **2 fps, 320 px JPEG frames in batches every 2 s** to
`POST /api/sessions/{id}/frames` (multipart: `frames[]` + `timestamps`). The backend:
- saves them to `data/sessions/<folder>/frames/<ts_ms>.jpg` (`SAVE_FRAMES=false` to disable),
- analyses them with OpenCV (`ml/video_features.py`): face present + face size, brightness, motion between frames,
  mean forehead RGB (for rPPG / heart rate later),
- keeps the latest window in live state → used by `/api/ml/predict-window` and shown in the admin panel.
The full `.webm` recording is still uploaded per segment at the end (`POST /api/sessions/{id}/recording`).

## EEG headset (BrainAccess) – two ways, no mock

**1. Via BrainAccess Board (recommended, automatic).** Connect the headset in the BrainAccess Board app as usual.
Board publishes it as an **LSL stream** (e.g. `BA MINI 074_MINI_BrainAccess`: 22 ch @ 250 Hz – 8 × EEG µV
labelled F3 F4 C3 C4 P3 P4 O1 O2, 8 × contact, 3 × accelerometer m/s², sample counter, streaming flag,
battery %). The backend picks it up by itself (`pylsl`) – no Bluetooth in our app, no conflict with Board.
Only streams from **this computer** are used (other teams' Boards on the same Wi-Fi are ignored;
`EEG_LSL_ALLOW_REMOTE=true` to change that). Several headsets in Board → choose one in the app.

**2. Directly, without Board.** In the app: "Connect directly (without BrainAccess Board)" → **Find headsets**
→ **Connect**. The backend connects with the **BrainAccess SDK 4.0.0** (`brainaccess` from PyPI – the same
wheel as in `BrainAccessSDK-4.0.0-macos_universal/python_api`) in a child process
(`app/eeg/direct_worker.py`). Requirements: the headset is on and **not connected in Board** (a connected
BLE headset is invisible to others); the backend was started from **Terminal / iTerm / VS Code** and macOS
was allowed to use Bluetooth (the SDK uses the terminal's Bluetooth permission). While connected directly,
listening to Board is paused; "Disconnect" goes back to Board mode.

States (`GET /api/eeg/status`, field `mode` = `board` | `direct`): `waiting` → `connected` (Board stream found)
/ `connecting` (direct) → `streaming`; `stalled` = Board stream without samples.
The start screen shows **skin contact per electrode** – 0/8 means the headset is not on the head
(dry electrodes must touch the scalp; the headset itself reports the contact flags).

**Pipeline**
- `app/eeg/eeg_source.py` – Board mode: background thread finds Board's BrainAccess EEG stream (this computer),
  reads channel labels/types from the stream description, pulls chunks (LSL timestamps → wall-clock ms).
  Direct mode: starts `app/eeg/direct_worker.py`. Both feed the same pipeline below.
- `app/eeg/processing.py` – per channel: band-pass 1–40 Hz + 50 Hz notch → **PTP µV**, contact quality
  (flat → `none`, contact flag 0 or >500 µV → `poor`), Welch band powers. Over channels with good contact:
  `ratio = (theta + alpha) / beta` (relative power within 4–30 Hz). **BRI is calibrated per person:** the median
  ratio of the first 60 s of clean signal (after connecting / at every session start) = BRI 25, 4× that ratio
  = BRI 100 (log scale). Windows with < 3 good electrodes (artifacts, PTP > 250 µV, clipped samples) are skipped;
  BRI holds for 5 s, then shows "no data" – never a fake value. A channel clipped at the amplifier rail
  (562 500 µV) = no skin contact; all channels clipped = the reference/bias electrode has no contact.
- `app/eeg/tuning.py` – all EEG numbers (windows, filters, thresholds, fatigue mapping, BRI smoothing).
- `app/eeg/recorder.py` – **raw EEG is recorded automatically during every session** (while data flows) into
  `data/sessions/<folder>/eeg_raw.csv`: `ts_ms` (epoch, from LSL timestamps), `sample_number` (gaps = lost
  samples), `streaming`, µV per electrode (`F3_uv` …), contact per electrode, accelerometer. Join with the
  browser tables (`face.csv`, `scroll.csv`, …) by `ts_ms`. No EEG during the session → no file.
  (Board's own recordings in `~/Documents/BrainAccessData/*.db` are independent and still work.)
- Each `windows` row stores `bri_eeg` from the headset at that moment (only if the data is < 2 s old).

API: `GET /api/eeg/status` · `POST /api/eeg/select` (Board stream) · `POST /api/eeg/scan` · `POST /api/eeg/connect`
· `POST /api/eeg/disconnect` (direct) · `GET /api/eeg/stream` (SSE) · `WS /ws/eeg/live`.

## ML – BRI (BrainRot Index)

- **BRI from EEG – working.** Computed in `app/eeg/processing.py` from the real electrodes (see above).
- **BRI from the camera – not implemented.** `POST /api/ml/predict-window` receives a 10 s feature window from the
  browser (MediaPipe face + scroll + viewing), adds the server's frame analysis and asks `CameraBriModel.predict`
  (`app/ml/predictor.py`), which returns `None` until a model is trained. The response always carries
  `briEeg` (EEG BRI at that moment), so the calm filter and the reel selector work on the EEG BRI today.
- **Training data is already collected:** every call is stored in `windows` (client features + video features
  + `bri_eeg` label) and in `ml_windows.csv` (`data/dataset/`). Contract of the model to build: [TODO.md](../TODO.md).

## Live state

Heartbeats (every 2 s per watching device), the latest frame analysis, predictions and the last 300 events
per session are kept **in memory** (`services/live_state.py`) – fast and fine for one uvicorn process.
With multiple workers move it to Redis.

## Data on disk

`DATA_DIR` (default `../data`, gitignored):

```text
data/
├── sessions/<YYYY-MM-DD_HH-MM>_<subject>_<session_id>/   # one folder per session, never overwritten
│   ├── session.csv recordings.csv events.csv reel_views.csv scroll.csv face.csv ml_windows.csv
│   ├── recording_<session>_<startMs>_<endMs>.webm        # one per recording segment
│   ├── eeg_raw.csv                                       # raw EEG from the headset (written by the backend)
│   └── frames/<ts_ms>.jpg
└── dataset/<table>.csv                                   # all sessions appended (+ _appended.json, no duplicates)
```
