"""Sync your `videos` table with REELS_CSV (dataset_videos/reels_metadata.csv).

Default (on every API start and `uv run seed`): only ADD rows that are in the CSV but not in the
table yet – edits you make in pgAdmin are never overwritten.
`uv run seed --update`: overwrite existing rows with the CSV values (CSV becomes the source of truth).
"""

import argparse
import asyncio
import csv
import logging
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert

from app.config import get_settings
from app.db import SessionLocal, create_tables
from app.models import Reel
from app.services.catalog import video_exists

log = logging.getLogger(__name__)

FLOAT_COLUMNS = [
    "duration", "fps", "cuts_per_sec", "motion_score", "flashes_per_sec", "audio_mean_db", "audio_max_db",
    "audio_dynamic_range", "engagement_rate", "objective_stim_score", "hybrid_brainrot_score",
]  # fmt: skip


def _float(v: str | None) -> float | None:
    try:
        return float(v) if v not in (None, "") else None
    except ValueError:
        return None


def parse_reels_csv(csv_path: Path) -> list[dict]:
    """CSV row -> dict with exactly the columns of the `videos` table."""
    rows: list[dict] = []
    with csv_path.open(newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if not r.get("filename"):
                continue
            row = {
                "filename": r["filename"].strip(),
                "youtube_id": r.get("youtube_id") or None,
                "title": (r.get("title") or "").strip() or None,
                "uploader": (r.get("uploader") or "").strip() or None,
                "category": r.get("category") or None,
                "stim_level": r.get("stim_level") or None,
                "is_vertical": (r.get("is_vertical") or "").strip().lower() == "true",
                "tags": r.get("tags") or None,
                "view_count": int(v) if (v := _float(r.get("view_count"))) is not None else None,
            }
            row.update({c: _float(r.get(c)) for c in FLOAT_COLUMNS})
            rows.append(row)
    return rows


async def seed_reels(update: bool = False) -> int:
    settings = get_settings()
    csv_path = settings.reels_csv_path
    async with SessionLocal() as db:
        if csv_path.is_file():
            rows = parse_reels_csv(csv_path)
            if rows:
                stmt = insert(Reel).values(rows)
                if update:
                    stmt = stmt.on_conflict_do_update(
                        index_elements=[Reel.filename],
                        set_={c: stmt.excluded[c] for c in rows[0] if c != "filename"},
                    )
                else:
                    stmt = stmt.on_conflict_do_nothing(index_elements=[Reel.filename])
                await db.execute(stmt)
                await db.commit()
        else:
            log.warning("Reels CSV not found: %s – using the videos table as is", csv_path)

        filenames = list(await db.scalars(select(Reel.filename)))
        total = await db.scalar(select(func.count()).select_from(Reel)) or 0

    available = sum(video_exists(f) for f in filenames)
    log.info("videos table: %d reels, %d with a video file in %s", total, available, settings.videos_path)
    if available == 0:
        log.warning("No video files found – check VIDEOS_DIR in backend/.env")
    return total


async def _main(update: bool) -> None:
    logging.basicConfig(level=logging.INFO)
    await create_tables()
    await seed_reels(update=update)


def run() -> None:
    """Entry point for `uv run seed [--update]`."""
    parser = argparse.ArgumentParser(description="Sync the videos table with reels_metadata.csv")
    parser.add_argument("--update", action="store_true", help="overwrite existing rows with CSV values")
    asyncio.run(_main(parser.parse_args().update))


if __name__ == "__main__":
    run()
