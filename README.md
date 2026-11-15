# BrainLoop (NeuroScroll)

Short-form video feed that measures how "brainrotted" you are – EEG headset + camera + scrolling –
and learns to detect it from the camera alone.

```text
frontend/        React + Vite + TS        – feed, settings, admin panel, camera/MediaPipe, data logging
backend/         FastAPI + Postgres + ML  – reels, sessions, live state, EEG stream, BRI prediction, data/ writer
dataset_videos/  (gitignored, local)      – reel .mp4 files + reels_metadata.csv (each teammate has a copy)
data/            (gitignored)             – session recordings, frames and CSV datasets
```

## Quick start

Needs a local PostgreSQL (e.g. PostgreSQL 18 + pgAdmin) with an empty database `db_brainloop_bci`.

```bash
cd backend && cp .env.example .env && uv sync    # put your Postgres password in DB_PASSWORD
uv run api                                       # API on http://localhost:8000 (docs: /docs)
cd ../frontend && npm install && npm run dev     # app on http://localhost:5173
```

Phone (camera needs HTTPS): `npm run dev:mobile` and open `https://<laptop-ip>:5173`.

Details: [backend/README.md](backend/README.md), [frontend/README.md](frontend/README.md).
