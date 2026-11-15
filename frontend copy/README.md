# BrainLoop frontend

BrainLoop is a short-video feed (think reels) that doubles as a data collection tool. While someone scrolls,
the app records the camera, tracks the face with MediaPipe, logs how they watch and scroll, and shows a live
BrainRot Index (BRI) computed by the backend from the EEG headset and the camera. When BRI stays high, an
optional calm filter slowly desaturates and slows down playback.

Stack: React 19, Vite, TypeScript, Tailwind v4, TanStack Query, Zustand, Motion. There are no mocks here,
everything comes from the FastAPI backend in `../backend`.

## Running it

Start the backend first (it should listen on `http://localhost:8000`, see `../backend/README.md`), then:

```bash
npm install
npm run dev          # http://localhost:5173
```

The Vite dev server proxies `/api`, `/media/videos` and `/ws` to the backend, so the app and the API share one
origin. Point it somewhere else with `BACKEND_URL=http://host:port npm run dev`.

To use a phone as the device under test:

```bash
npm run dev:mobile   # https://<laptop-ip>:5173
```

Phones only allow camera access over HTTPS, so this mode serves a self-signed certificate on the LAN. Accept the
warning on the phone. It still talks to the backend through the same proxy, so the admin panel on the laptop
sees it live.

`npm run build` typechecks and builds, `npm run lint` runs oxlint.

### MediaPipe model

The MediaPipe WASM files are copied into `public/mediapipe/wasm` on `npm install` (`scripts/copy-mediapipe.mjs`).
The face model itself is downloaded from Google Storage at runtime. To run fully offline, download it once:

```bash
mkdir -p public/models
curl -L -o public/models/face_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
```

and add `VITE_FACE_MODEL_URL=/models/face_landmarker.task` to `.env`.

## Screens

- `/` start screen: subject name and optional camera recording (video only, no audio)
- `/feed` the reels, served by the backend in small batches. Starts with a short fixation cross to measure the
  person's resting baseline
- `/settings` theme, calm filter with a preview slider, stats, exports, ending the session
- `/admin` live view of what the other device is watching, EEG brain map, BRI chart, event stream

The feed stays mounted for the whole session, so switching to Settings and back keeps the same reel and position.

## Where things live

```text
src/
  api/          one small file per backend module, plus client.ts (http, wsUrl, mediaUrl)
  hooks/        React Query hooks over api/, queryKeys.ts
  types/        api/input and api/output per hooks file, domain/ for shared types
  store/        Zustand stores (session, settings, recording, brainrot, calm, playback, csvLog, ...)
  services/     things that live outside React: cameraRecorder, face/ (MediaPipe), brainrot/ (WS client),
                dataLogger/ (CSV tables), storage/ (IndexedDB)
  features/     logic and components per area (feed, settings, admin, recording, calm, ml, session, ...)
  pages/        thin route components
  components/   shared UI (ui/, layout/, feedback/)
  config/       tuning.ts, calmFilter.ts, tracking.ts
  lib/          small helpers (csv, format, files, timebase, realtime SSE/WS)
  app/          router, providers, query client, theme sync, IndexedDB restore on start
```

## Where the data goes

During a session the frontend keeps several tables in memory and autosaves new rows to IndexedDB every second,
so a page refresh doesn't lose anything. Video is saved the same way, one-second chunks straight into IndexedDB.
After a refresh the tables are restored and a banner offers to resume recording as a new segment.

When the session ends, everything is uploaded to the backend, which writes it to `data/` in the project root:

```text
data/
  sessions/<date>_<time>_<name>_<session_id>/
    session.csv  recordings.csv  events.csv  reel_views.csv  scroll.csv  face.csv  ml_windows.csv
    recording_<session>_<startMs>_<endMs>.webm   one per segment
    eeg_raw.csv                                  written by the backend while the headset streams
    frames/                                      camera frames sent during the session
  dataset/                                       all sessions appended, one file per table
```

What the tables hold, roughly:

- `session.csv`: one row with session and recording start/end, segment count, video files, tracker rate
- `recordings.csv`: one row per video segment, with `offset_from_origin_ms` and whether it was interrupted
- `events.csv`: discrete events (reel views, likes, pauses, loops, calm filter changes, settings, ...)
- `reel_views.csv`: one row per reel view (dwell, real playback time, watch %, loops, exit direction and speed)
- `scroll.csv`: scroll speed samples while the user is moving
- `face.csv`: MediaPipe features per frame (EAR, blinks, PERCLOS, gaze, head pose, forehead RGB, a few landmarks)
- `ml_windows.csv`: every 2 s, a 10 s feature window sent to `/api/ml/predict-window` and the response

Every table has `session_id`, `ts_ms` (epoch) and `t_rel_ms`, which counts from the start of the first recording
segment. For segment 0 the video second is `t_rel_ms / 1000`, for later ones subtract `offset_from_origin_ms`.

The uploads go to `POST /api/sessions/{id}/recording` and `POST /api/sessions/{id}/dataset`. During the session
the app also sends JPEG frames to `POST /api/sessions/{id}/frames` (2 fps, batched) and a heartbeat to
`POST /api/live/active-reel` that the admin panel reads. If the upload fails, or the ZIP switch is on in Settings,
a ZIP with all CSVs and video is downloaded as well.

## Live BRI

The face tracker (`services/face/faceTracker.ts`) streams raw MediaPipe frames over a single WebSocket,
`/ws/brainrot` (`services/brainrot/brainrotClient.ts`). The backend Brain Rot engine combines them with the EEG
headset and pushes back the BRI state twice a second into `store/brainrotStore.ts`. BRI 25 means "this person at
rest" (measured during the fixation cross) and 70 or more counts as brain rot. The calm filter, reminders and the
admin panel all read from that store.

The EEG snapshots for the admin brain map come separately from `/api/eeg/stream` (SSE, or `/ws/eeg/live` with
`VITE_EEG_TRANSPORT=ws`). The older camera + scroll predictor behind `/api/ml/predict-window` is still called and
logged to `ml_windows.csv`, but its camera model is a placeholder on the backend for now.

## Tuning

Almost every number worth changing is in `src/config/tuning.ts`: calm filter thresholds, strength and timing,
fixation cross length, feed batch size and prefetch, data collection rates, autosave interval. The calm filter
math is in `src/config/calmFilter.ts`, and the MediaPipe model/WASM locations in `src/config/tracking.ts`.
Save the file and Vite reloads the app.
