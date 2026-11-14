# BrainLoop – frontend

React 19 + Vite + TypeScript + Tailwind v4 + TanStack Query + Zustand + Motion.
**For now everything runs on mocks** (`VITE_USE_MOCKS=false` switches to the real backend).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build
```

## Screens

| Route       | Screen |
| ----------- | ----- |
| `/`         | Start: username + optional camera recording (no audio) |
| `/feed`     | Reel feed: snap-scroll up/down, like (button / double-tap), pause (tap), pull-to-refresh, ↑/↓ |
| `/settings` | Profile, dark/light theme, calm filter, statistics, CSV/recording export, end session |
| `/admin`    | Admin panel: currently watched reel, highlighted brain (EEG), fatigue, event stream |

The admin panel in **another tab** of the same browser sees live what is being scrolled
(a mock "backend" in `localStorage`). Across different devices only a real backend can do this.

## `src/` structure

```text
api/                  # API functions - each has a MOCK branch and an http() branch
  client.ts           # USE_MOCKS, http(), mockDelay()
  feed.api.ts  session.api.ts  user.api.ts  admin.api.ts
  mocks/              # ⚠️ MOCKS: reels, user, brain (EEG), mockDb (localStorage)
hooks/                # React Query - one file per module
  useFeed.ts  useSession.ts  useUser.ts  useAdmin.ts  queryKeys.ts
types/
  api/input/<hook>.ts   # input payloads for the given hooks file
  api/output/<hook>.ts  # API responses for the given hooks file
  domain/               # Reel, UserProfile, SessionInfo, BrainSnapshot, CsvRow
store/                # Zustand: settings, session, recording, csvLog (global CSV)
services/             # cameraRecorder.ts - MediaRecorder (video only) outside React
features/             # logic + components per screen (onboarding, feed, settings, admin, recording, session)
components/           # ui/ (Button, Card, Switch…), layout/, feedback/
pages/                # thin pages composing components from features/
app/                  # router, providers, queryClient, theme
lib/                  # cn, format, csv, files (download), useNow
```

## Session data (for model training)

After "End session" the data lands in the **`data/`** folder in the project directory (next to `frontend/`, in `.gitignore`):

```text
data/
├── sessions/                                   # one session = one folder, nothing gets overwritten
│   ├── 2026-11-14_12-18_kacper_ses_xxx/        # date_time_person_id
│   │   ├── session.csv  recordings.csv  events.csv  reel_views.csv
│   │   ├── scroll.csv  face.csv  ml_windows.csv
│   │   └── recording_ses_xxx_<startMs>_<endMs>.webm
│   └── 2026-11-14_12-40_ola_ses_yyy/
└── dataset/                                    # AGGREGATED: rows of all sessions in one file per table
    ├── session.csv  events.csv  face.csv  ml_windows.csv  ...
    └── _appended.json                          # which sessions are already appended (re-saving = skipped)
```

- Successive sessions **accumulate**: each has its own folder, and `dataset/*.csv` grows by its rows (distinguished by `session_id`).
- When the set of columns changes, rows go to a new file `table__<hash>.csv` instead of corrupting the old one.
- Saving is done by a Vite server plugin (`vite/localDataSink.ts`) - works in `npm run dev` and `dev:mobile` (the phone saves to the laptop). Change the folder with the `LOCAL_DATA_DIR` variable.
- Without the dev server (e.g. `vite preview`), or with the "Also download ZIP" switch in Settings, a ZIP bundle is downloaded as well.
- With a real backend (`VITE_USE_MOCKS=false`) files go to FastAPI (`POST /api/sessions/{id}/recording`, `/dataset`), which should save in the same layout.

| File | Contents | Frequency |
| ---- | ---------- | ------------- |
| `session.csv` | 1 row: session start/end **and recording start/end**, number of segments, video files, mime, tracker Hz | once |
| `recordings.csv` | 1 row per video segment: start, end, `offset_from_origin_ms`, `interrupted` (cut off by a refresh), file | once |
| `events.csv` | events: `session_*`, `recording_*`, `reel_view_start/end`, `reel_loop`, `reel_pause/resume`, `reel_like/unlike`, `feed_refresh`, `settings_change`, `face_tracker_*` | on event |
| `reel_views.csv` | 1 row per view: `dwell_ms`, `played_ms`, `watch_pct` (% of the reel, >100 when looping), `completed_loops`, `pause_count`, `liked`, `exit_direction`, `exit_scroll_speed_reels_s` | on reel change |
| `scroll.csv` | `velocity_px_s`, `velocity_reels_s`, direction, active reel | every 100 ms, only while moving |
| `ml_windows.csv` | every 2 s: feature window from the last 10 s (face + scroll + viewing) sent to the model and its `bri_ai` response - a ready dataset for training/comparison with EEG | 0.5 Hz |
| `face.csv` | MediaPipe: EAR L/R, blinks (blendshapes), blink rate, PERCLOS 60 s, gaze direction, yawning, head pitch/yaw/roll, mean forehead RGB (for rPPG/heart rate) + ~14 selected landmarks (nose, chin, forehead, eye corners, irises, mouth) | 10 Hz |
| `recording_<session>_<startMs>_<endMs>.webm` | camera video, **no audio** (one file per segment) | – |

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

## BRI (BrainRot Index) - admin panel

Two independent indicators 0..100 (break threshold: 70):
- **BRI · EEG** – the `bri` field in the EEG stream message; computed by the backend from the electrodes (the teacher).
- **BRI · AI** – a "no headset" model: every 2 s the user's device builds a feature window
  (`features/ml/buildFeatureWindow.ts`) and calls `POST /api/ml/predict-window` → `{ bri, shouldStop, modelVersion, topFactors }`.
  ⚠️ Right now this is a **mock** (`api/mocks/ml.mock.ts`) - a hand-written heuristic, not a trained model. After LightGBM training, an endpoint in the backend is all that is needed.
- The middle chart shows both curves and the difference Δ - an argument for the jury that camera AI sees the same thing as EEG.

## EEG stream from FastAPI (`yield`)

The frontend listens (`hooks/useEeg.ts` → `api/eeg.api.ts`). Each message = a `BrainSnapshot` JSON
(`types/domain/brain.ts`) - channels as on the BrainAccess EEG headset (`F4 F3 C4 C3 P4 P3 O2 O1` + accelerometer):

```json
{
  "tMs": 1731590000000,
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
- `bri` - BrainRot Index 0..100 from EEG.

`.env`: `VITE_USE_MOCKS=false`, `VITE_API_URL=http://<ip>:8000`, `VITE_EEG_TRANSPORT=sse` (or `ws`).

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
The admin on the laptop can see the phone only with a real backend - the mock keeps state in the localStorage of a single browser.
