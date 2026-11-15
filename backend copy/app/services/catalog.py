"""Reads the videos table. It's small, so it is loaded whole and filtered in Python."""

from functools import lru_cache

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Reel


# cached per process, restart after adding video files
@lru_cache(maxsize=4096)
def video_exists(filename: str) -> bool:
    return (get_settings().videos_path / filename).is_file()


async def available_reels(db: AsyncSession) -> list[Reel]:
    reels = await db.scalars(select(Reel).order_by(Reel.filename))
    return [r for r in reels if video_exists(r.filename)]


async def get_reel(db: AsyncSession, reel_id: str) -> Reel | None:
    # reel_id ends up in a LIKE pattern
    if "/" in reel_id or "%" in reel_id:
        return None
    rows = await db.scalars(
        select(Reel).where(or_(Reel.filename.like(f"%/{reel_id}.%"), Reel.filename.like(f"{reel_id}.%")))
    )
    return next((r for r in rows if r.id == reel_id), None)
