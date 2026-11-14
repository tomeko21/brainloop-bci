"""Mapping DB reels -> API reels."""

from datetime import UTC, datetime
from urllib.parse import quote

from app.models import Reel
from app.schemas import ReelAuthor, ReelMetrics, ReelOut
from app.utils import stable_hash

MOOD_BY_STIM = {"low": "calm", "medium": "neutral", "high": "intense"}


def base_likes(reel: Reel) -> int:
    """engagement_rate in the dataset is a percentage of views."""
    return round((reel.view_count or 0) * (reel.engagement_rate or 0) / 100)


def to_reel_out(reel: Reel, liked_by_me: bool) -> ReelOut:
    h = stable_hash(reel.id)
    category = reel.category or "other"
    hue_a = h % 360
    likes = base_likes(reel) + (1 if liked_by_me else 0)
    return ReelOut(
        id=reel.id,
        author=ReelAuthor(
            handle=reel.uploader or "unknown",
            avatar_hue=stable_hash(reel.uploader or "") % 360,
            verified=(reel.view_count or 0) > 1_000_000,
        ),
        caption=reel.title or "",
        tags=[t for t in reel.tag_list if t.startswith("#")] or [category.replace("_", " ")],
        duration_sec=reel.duration or 0,
        palette=(hue_a, (hue_a + 80 + h % 100) % 360),  # fallback gradient while the video loads
        mood=MOOD_BY_STIM.get(reel.stim_level or "", "neutral"),
        likes=likes,
        comments=likes // 30,
        liked_by_me=liked_by_me,
        created_at=datetime.fromtimestamp(1_730_000_000 + h % 5_000_000, UTC).isoformat(),
        video_url=f"/media/videos/{quote(reel.filename)}",
        category=category,
        stim_level=reel.stim_level or "medium",
        metrics=ReelMetrics(
            cuts_per_sec=reel.cuts_per_sec or 0,
            motion_score=reel.motion_score or 0,
            flashes_per_sec=reel.flashes_per_sec or 0,
            objective_stim_score=reel.objective_stim_score or 0,
            brainrot_score=reel.hybrid_brainrot_score or 0,
        ),
    )
