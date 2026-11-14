"""Start the API server:  `uv run api`  (or `uv run python -m app`).

Uvicorn is the web server that runs the FastAPI app – this wrapper just hides its flags.
Options: --port 8000, --host 0.0.0.0 (reachable from the LAN / phone), --no-reload.
"""

import argparse
from pathlib import Path

import uvicorn


def main() -> None:
    parser = argparse.ArgumentParser(description="BrainLoop API server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-reload", action="store_true", help="disable auto-restart on code changes")
    args = parser.parse_args()
    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=not args.no_reload,
        # Watch only our code – not .venv (installing packages must not restart the server)
        reload_dirs=[str(Path(__file__).resolve().parent)],
        # Open live streams (SSE / WebSocket from the admin panel) never end by themselves –
        # without this a reload / Ctrl+C would wait for them forever.
        timeout_graceful_shutdown=2,
    )


if __name__ == "__main__":
    main()
