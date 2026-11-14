# BrainLoop – frontend

React 19 + Vite + TypeScript + Tailwind v4 + TanStack Query + Zustand + Motion.
**No mocks in the frontend** – all data comes from the FastAPI backend (`../backend`, see its README).
The Vite dev server proxies `/api`, `/media/videos` and `/ws` to `http://localhost:8000`
(override with `BACKEND_URL=...`), so the app and the API share one origin.

```bash
npm install
npm run dev        # http://localhost:5173  (start the backend first)
npm run build      # typecheck + build
```

## Screens

| Route       | Screen |
| ----------- | ----- |
| `/`         | Start: username + optional camera recording (no audio) |
| `/feed`     | Real video reels from the dataset (loaded 5 at a time, chosen by the backend), like (button / double-tap), pause (tap), sound on/off, pull-to-refresh, ↑/↓ |
| `/settings` | Profile, dark/light theme, calm filter (with live preview), statistics, CSV/recording export, end session |
| `/admin`    | Admin panel: currently watched reel, highlighted brain (EEG), fatigue, event stream |

The admin panel (any device) sees live what is being watched: the feed sends a heartbeat every 2 s
(reel, playback position, face summary, AI prediction, new events) and the backend keeps the live state.

## Fine-tuning

**All tunable numbers are in [`src/config/tuning.ts`](src/config/tuning.ts)**: calm filter (thresholds, strength,
fade-in/out speed, instant off, reminder interval), feed (batch size, prefetch, double tap, pull-to-refresh),
playback bookkeeping, data collection rates, ML window, autosave, page fade. Save the file – Vite reloads the app.

The feed stays mounted for the whole session (hidden on other tabs), so switching to Settings and back keeps the
same reel, video time and scroll position.

## `src/` structure

```text
api/                  # thin functions calling the backend (one file per module)
  client.ts           # http(), query(), mediaUrl(), wsUrl()
  feed.api.ts  session.api.ts  frames.api.ts  user.api.ts  admin.api.ts  eeg.api.ts  ml.api.ts  health.api.ts
hooks/                # React Query - one file per module
  useFeed.ts  useSession.ts  useFrames.ts  useUser.ts  useAdmin.ts  useEeg.ts  useMl.ts  useHealth.ts  queryKeys.ts
types/
  api/input/<hook>.ts   # input payloads for the given hooks file
  api/output/<hook>.ts  # API responses for the given hooks file
  domain/               # Reel, UserProfile, SessionInfo, BrainSnapshot, CsvRow
store/                # Zustand: settings, session, recording, csvLog (global CSV)
services/             # cameraRecorder (MediaRecorder), face/ (MediaPipe), dataLogger/ (CSV tables), storage/ (IndexedDB)
features/             # logic + components per screen (onboarding, feed, settings, admin, recording, session)
components/           # ui/ (Button, Card, Switch…), layout/, feedback/
pages/                # thin pages composing components from features/
app/                  # router, providers, queryClient, theme
lib/                  # cn, format, csv, files (download), useNow
```

## Session data (for model training)

After "End session" the frontend uploads everything to the backend, which writes it to the **`data/`** folder
in the project directory (next to `frontend/`, in `.gitignore`). During the session the backend also receives
camera frames (2 fps, 320 px JPEG, in batches every 2 s) and stores them in `frames/`:

```text
data/
├── sessions/                                   # one session = one folder, nothing gets overwritten
│   ├── 2026-11-14_12-18_kacper_ses_xxx/        # date_time_person_id
│   │   ├── session.csv  recordings.csv  events.csv  reel_views.csv
│   │   ├── scroll.csv  face.csv  ml_windows.csv
│   │   ├── recording_ses_xxx_<startMs>_<endMs>.webm
│   │   ├── eeg_raw.csv                         # raw EEG from the BrainAccess headset (backend)
│   │   └── frames/<ts_ms>.jpg                  # camera frames analysed live by the backend
│   └── 2026-11-14_12-40_ola_ses_yyy/
└── dataset/                                    # AGGREGATED: rows of all sessions in one file per table
    ├── session.csv  events.csv  face.csv  ml_windows.csv  ...
    └── _appended.json                          # which sessions are already appended (re-saving = skipped)
```

- Successive sessions **accumulate**: each has its own folder, and `dataset/*.csv` grows by its rows (distinguished by `session_id`).
- When the set of columns changes, rows go to a new file `table__<hash>.csv` instead of corrupting the old one.
- Endpoints: `POST /api/sessions/{id}/recording` (each video segment), `POST /api/sessions/{id}/dataset` (all CSVs),
  `POST /api/sessions/{id}/frames` (live frames). Reel views and events are also imported into Postgres.
- If the upload fails, or with the "Also download ZIP" switch in Settings, a ZIP bundle is downloaded too.

| File | Contents | Frequency |
| ---- | ---------- | ------------- |
| `session.csv` | 1 row: session start/end **and recording start/end**, number of segments, video files, mime, tracker Hz | once |
| `recordings.csv` | 1 row per video segment: start, end, `offset_from_origin_ms`, `interrupted` (cut off by a refresh), file | once |
| `events.csv` | events: `session_*`, `recording_*`, `reel_view_start/end`, `reel_loop`, `reel_pause/resume`, `reel_like/unlike`, `feed_refresh`, `settings_change`, `face_tracker_*`, `calm_filter`, `scroll_reminder` | on event |
| `reel_views.csv` | 1 row per view: `dwell_ms`, `played_ms`, `watch_pct` (% of the reel, >100 when looping), `completed_loops`, `pause_count`, `liked`, `exit_direction`, `exit_scroll_speed_reels_s` | on reel change |
| `scroll.csv` | `velocity_px_s`, `velocity_reels_s`, direction, active reel | every 100 ms, only while moving |
| `ml_windows.csv` | every 2 s: feature window from the last 10 s (face + scroll + viewing) sent to the model and its `bri_ai` response - a ready dataset for training/comparison with EEG | 0.5 Hz |
| `face.csv` | MediaPipe: EAR L/R, blinks (blendshapes), blink rate, PERCLOS 60 s, gaze direction, yawning, head pitch/yaw/roll, mean forehead RGB (for rPPG/heart rate) + ~14 selected landmarks (nose, chin, forehead, eye corners, irises, mouth) | 10 Hz |
| `recording_<session>_<startMs>_<endMs>.webm` | camera video, **no audio** (one file per segment) | – |
| `eeg_raw.csv` | raw EEG (µV per electrode, contact, accelerometer, sample counter) – written by the backend while the session runs | headset rate (e.g. 250 Hz) |

All tables have `session_id`, `ts_ms` (epoch) and `t_rel_ms` = ms since the start of the **first** recording segment.
Segment 0: video second = `t_rel_ms / 1000`; later segments: `(t_rel_ms - offset_from_origin_ms) / 1000`.
Change the rates in `src/config/tracking.ts`.

### Resilience to page refresh
- The `face`/`scroll`/`reel_views` tables live in memory, and **every 1 s new rows are appended to IndexedDB** (`services/storage/tableAutosave.ts`). On close/refresh the last batch goes synchronously to localStorage.
- Video: every 1-second chunk from MediaRecorder goes straight to IndexedDB (`services/storage/videoStore.ts`).
- After a refresh the tables are restored (`app/DataBootstrap.tsx`) and the camera is off - the **"Resume"** banner starts the next segment.
- "End session" collects all segments into a ZIP bundle and only then clears IndexedDB. "ZIP bundle (CSV + video so far)" in Settings downloads the current state without ending the session.

### MediaPipe offline
WASM is copied from `node_modules` on `npm install` (`scripts/copy-mediapipe.mjs`).
The model is fetched from Google Storage by default; for offline use:
```bash
mkdir -p public/models && curl -L -o public/models/face_landmarker.task https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
```
and in `.env`: `VITE_FACE_MODEL_URL=/models/face_landmarker.task`.

## Calm filter

Enabled in Settings (on by default). It does **not** change which reels are served – it softens playback
when a dopamine peak is detected – high BRI (best available: the camera model once trained, **today the EEG
headset**; `features/calm/useCalmFilter.ts`):

| | at 0% | at 100% |
|---|---|---|
| colour saturation (overlay) | 100% | 10% (almost B&W, never fully) |
| contrast | 100% | 85% |
| playback speed | 1.0× | 0.7× (pitch preserved) |
| volume | 100% | 60% |

- Intensity target = BRI 50 → 0%, BRI 90 → 100%; the real intensity ramps slowly (in ~45 s, out ~30 s).
  Switching the filter OFF in Settings removes the effect immediately.
- Colours are changed by an overlay above the video (`backdrop-filter`), speed and volume live on the playing
  `<video>` – the reel never reloads or restarts.
- Every 5 min of scrolling a reminder toast shows the session time.
- Settings has a **Preview** slider to demo the effect; every 10% step is logged as `calm_filter` in `events.csv`,
  reminders as `scroll_reminder`.
- The admin mirror applies the same intensity (sent with the heartbeat).

## BRI (BrainRot Index) - admin panel

Two independent indicators 0..100 (break threshold: 70):
- **BRI · EEG** – the `bri` field in the EEG stream message; computed by the backend from the electrodes (the teacher).
- **BRI · AI** – a "no headset" model: every 2 s the user's device builds a feature window
  (`features/ml/buildFeatureWindow.ts`) and calls `POST /api/ml/predict-window` → `{ bri, briEeg, shouldStop, modelVersion, topFactors }`.
  ⚠️ The camera model is **not trained yet** (`backend/app/ml/predictor.py` returns no value, badge "not trained");
  the response always includes `briEeg`, which the calm filter and the reel selection use meanwhile. See `../TODO.md`.
- The middle chart shows both curves and the difference Δ - an argument for the jury that camera AI sees the same thing as EEG.

## EEG stream from FastAPI (`yield`)

The frontend listens (`hooks/useEeg.ts` → `api/eeg.api.ts`); the backend implementation is in
`backend/app/routers/eeg.py` + `backend/app/eeg/`. Each message = a `BrainSnapshot` JSON
(`types/domain/brain.ts`) - channels as on the BrainAccess EEG headset (`F4 F3 C4 C3 P4 P3 O2 O1` + accelerometer):

```json
{
  "tMs": 1731590000000,
  "source": "brainaccess-board",
  "channels": { "F4": 0.42, "F3": 0.55, "C4": 0.6, "C3": 0.31, "P4": 0.7, "P3": 0.5, "O2": 0.8, "O1": 0.77 },
  "ptpUv":    { "F4": 0.0, "F3": 53389.5, "C4": 47.9, "C3": 61.2, "P4": 49.9, "P3": 88.1, "O2": 0.0, "O1": 72.4 },
  "quality":  { "F4": "none", "F3": "poor", "C4": "good" },
  "bands": { "theta": 0.6, "alpha": 0.55, "beta": 0.4 },
  "fatigueScore": 0.71,
  "shouldStop": false,
  "accel": { "x": 0.01, "y": -0.02, "z": 0.98 }
}
```
- `channels` - normalized activity 0..1 (brain highlighting),
- `ptpUv` - peak-to-peak in µV as in the BrainAccess app,
- `quality` - optional; when absent, the frontend computes it from PTP (`lib/eeg.ts`): `0 µV` = no signal, `> 500 µV` = poor contact / saturation, otherwise good. Channels without good contact do not light up on the brain map,
- `accel` - optional, in g,
- `bri` - BrainRot Index 0..100 from EEG,
- `source` - `"brainaccess-board"`. The headset is connected in the **BrainAccess Board** app; the backend
  listens to Board's LSL stream. No data = no messages (the admin panel shows "Connect the EEG headset to see
  live data"). Status is shown on the start screen, in Settings and in the admin panel.

Transport: SSE by default, `VITE_EEG_TRANSPORT=ws` switches to the WebSocket.

**SSE (default) - generator with `yield`:**
```python
from fastapi.responses import StreamingResponse
import asyncio, json

@app.get("/api/eeg/stream")
async def eeg_stream(session_id: str | None = None):
    async def gen():
        async for snapshot in read_electrodes():          # your read from the EEG headset / bridge
            yield f"data: {json.dumps(snapshot)}\n\n"
    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
```
**WebSocket:** `@app.websocket("/ws/eeg/live")` and `await ws.send_json(snapshot)` in a loop.
Both variants auto-reconnect (`lib/realtime/`), and the status is visible in the admin panel (badge next to the brain).

## Phone

The layout is mobile-first (full-screen feed, `100dvh`, safe-area). The camera on a phone requires **HTTPS**:
```bash
npm run dev:mobile   # https://<laptop-ip>:5173 (accept the self-signed certificate)
```
The phone talks to the backend through the same Vite proxy, so the admin panel on the laptop sees it live.
