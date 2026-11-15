"""Session files under DATA_DIR/sessions/<date>_<subject>_<id>/ plus the aggregated DATA_DIR/dataset/."""

import json
import re
import shutil
import threading
from datetime import datetime
from pathlib import Path
from typing import BinaryIO

from app.config import get_settings
from app.utils import slug, stable_hash

SAFE_NAME = re.compile(r"^[A-Za-z0-9._-]+$")
_dataset_lock = threading.Lock()


class InvalidFileName(ValueError):
    pass


def session_folder_name(session_id: str, subject_name: str, started_at_ms: int) -> str:
    d = datetime.fromtimestamp(started_at_ms / 1000)
    return f"{d:%Y-%m-%d_%H-%M}_{slug(subject_name)}_{session_id}"


def _safe(name: str) -> str:
    if not SAFE_NAME.match(name) or name in {".", ".."}:
        raise InvalidFileName(name)
    return name


def session_dir(folder: str) -> Path:
    path = get_settings().data_path / "sessions" / _safe(folder)
    path.mkdir(parents=True, exist_ok=True)
    return path


def relative_to_project(path: Path) -> str:
    root = get_settings().data_path.parent
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)


def save_stream(folder: str, name: str, src: BinaryIO) -> Path:
    target = session_dir(folder) / _safe(name)
    with target.open("wb") as out:
        shutil.copyfileobj(src, out, length=1024 * 1024)
    return target


def save_text(folder: str, name: str, text: str) -> Path:
    target = session_dir(folder) / _safe(name)
    target.write_text(text, encoding="utf-8")
    return target


def save_frame(folder: str, ts_ms: int, data: bytes) -> Path:
    frames = session_dir(folder) / "frames"
    frames.mkdir(exist_ok=True)
    target = frames / f"{int(ts_ms)}.jpg"
    target.write_bytes(data)
    return target


def append_to_dataset(table: str, session_id: str, csv_text: str) -> int | str:
    """Appends once per session and table; a changed header goes to <table>__<hash>.csv."""
    _safe(table)
    _safe(session_id)
    dataset = get_settings().data_path / "dataset"
    dataset.mkdir(parents=True, exist_ok=True)
    index_file = dataset / "_appended.json"

    with _dataset_lock:
        index: dict[str, list[str]] = json.loads(index_file.read_text()) if index_file.exists() else {}
        if session_id in index.get(table, []):
            return "skipped"

        lines = csv_text.rstrip("\n").split("\n")
        header, rows = lines[0], lines[1:]
        target = dataset / f"{table}.csv"
        if target.exists():
            with target.open(encoding="utf-8") as f:
                existing_header = f.readline().rstrip("\n")
            if existing_header != header:
                target = dataset / f"{table}__{stable_hash(header):08x}.csv"
        if not target.exists():
            target.write_text(header + "\n", encoding="utf-8")
        if rows:
            with target.open("a", encoding="utf-8") as f:
                f.write("\n".join(rows) + "\n")

        index.setdefault(table, []).append(session_id)
        index_file.write_text(json.dumps(index, indent=2))
        return len(rows)
