"""Users are just subject names, there are no accounts."""

from datetime import UTC, datetime

from fastapi import APIRouter
from sqlalchemy import func, select

from app.deps import DbDep
from app.models import Like, ReelView, Session, Window
from app.schemas import UserProfile, UserStats
from app.utils import now_ms, stable_hash

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/{subject_name}", response_model=UserProfile)
async def get_profile(subject_name: str, db: DbDep) -> UserProfile:
    first = await db.scalar(
        select(func.min(Session.started_at_ms)).where(Session.subject_name == subject_name)
    )
    h = stable_hash(subject_name)
    return UserProfile(
        subject_name=subject_name,
        role="admin" if subject_name.lower() == "admin" else "subject",
        device_id=f"dev-{h:08x}"[:10],
        joined_at=datetime.fromtimestamp((first or now_ms()) / 1000, UTC).isoformat(),
        avatar_hue=h % 360,
    )


@router.get("/{subject_name}/stats", response_model=UserStats)
async def get_stats(subject_name: str, db: DbDep) -> UserStats:
    session_ids = select(Session.id).where(Session.subject_name == subject_name)
    views, avg_dwell = (
        await db.execute(
            select(func.count(ReelView.id), func.avg(ReelView.dwell_ms)).where(
                ReelView.session_id.in_(session_ids)
            )
        )
    ).one()
    likes = await db.scalar(select(func.count(Like.id)).where(Like.subject_name == subject_name, Like.liked))
    total_ms = await db.scalar(
        select(func.sum(func.coalesce(Session.ended_at_ms, now_ms()) - Session.started_at_ms)).where(
            Session.subject_name == subject_name
        )
    )
    # camera BRI when present, otherwise EEG
    bri = func.coalesce(Window.bri_ai, Window.bri_eeg)
    avg_bri = await db.scalar(select(func.avg(bri)).where(Window.session_id.in_(session_ids)))
    recent = list(
        await db.scalars(
            select(bri)
            .where(Window.session_id.in_(session_ids), bri.is_not(None))
            .order_by(Window.ts_ms.desc())
            .limit(12)
        )
    )
    return UserStats(
        reels_watched=views or 0,
        likes_given=likes or 0,
        avg_watch_time_sec=round((avg_dwell or 0) / 1000, 1),
        total_session_time_sec=round((total_ms or 0) / 1000),
        avg_fatigue=round((avg_bri or 0) / 100, 2),
        focus_trend=[round(1 - b / 100, 3) for b in reversed(recent)],
    )
