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

### Phone + laptop (scroll on the phone, admin panel on the laptop)

Everything runs on the laptop, the phone only opens the page. Phone and laptop must be on the same Wi-Fi.

```bash
cd backend && uv run api              # terminal 1, backend stays on 127.0.0.1:8000, no --host needed
cd frontend && npm run dev:mobile     # terminal 2, HTTPS on the LAN (phones allow the camera only over HTTPS)
```

- Vite prints a `Network:` address, e.g. `https://192.168.1.23:5173` (or check the laptop IP with
  `ipconfig getifaddr en0` on macOS). Open it on the phone and accept the self-signed certificate warning.
- On the laptop open `https://localhost:5173/admin` for the admin panel with the live BRI.
- The phone never talks to the backend directly: Vite proxies `/api`, `/media/videos` and `/ws` to
  `127.0.0.1:8000`, so there is no CORS or firewall setup for port 8000. If the phone can't load the page,
  allow incoming connections for node/Vite in the macOS firewall, or check that the Wi-Fi isn't a guest
  network with client isolation.
- EEG: connect the headset in BrainAccess Board on the laptop before starting, the backend picks up the stream.

Details: [backend/README.md](backend/README.md), [frontend/README.md](frontend/README.md).
