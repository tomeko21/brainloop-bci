"""Entry point for `uv run api`. Use --host 0.0.0.0 to reach it from a phone on the LAN."""

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
        # watch only app/, otherwise uv sync touching .venv restarts the server
        reload_dirs=[str(Path(__file__).resolve().parent)],
        # open SSE/WS streams never end on their own, reload and Ctrl+C would hang on them
        timeout_graceful_shutdown=2,
    )


if __name__ == "__main__":
    main()
