"""Feed endpoints, called from frontend/src/api/feed.api.ts."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.deps import DbDep, get_session_or_404
from app.eeg.hub import get_hub
from app.models import Like, ReelImpression, Window
from app.schemas import FeedPage, ToggleLikeIn, ToggleLikeOut
from app.services.catalog import available_reels, get_reel
from app.services.engagement import assess, views_from_events
from app.services.live_state import live_state
from app.services.reel_selector import SelectionContext, select_batch
from app.services.reels import base_likes, to_reel_out
from app.utils import now_ms, stable_hash

router = APIRouter(prefix="/api/feed", tags=["feed"])


async def _liked_ids(db: DbDep, subject_name: str | None) -> set[str]:
    if not subject_name:
        return set()
    rows = await db.scalars(select(Like.reel_id).where(Like.subject_name == subject_name, Like.liked))
    return set(rows)


async def _latest_bri(db: DbDep, session_id: str) -> float | None:
    bri = live_state.latest_bri(session_id)
    if bri is not None:
        return bri
    # no prediction from the browser (camera off), use the headset
    if (snap := get_hub().fresh_latest()) and snap.get("bri") is not None:
        return snap["bri"]
    return await db.scalar(
        select(func.coalesce(Window.bri_ai, Window.bri_eeg))
        .where(Window.session_id == session_id)
        .order_by(Window.ts_ms.desc())
        .limit(1)
    )


@router.get("", response_model=FeedPage)
async def get_feed(
    db: DbDep,
    session_id: str | None = None,
    cursor: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int | None, Query(ge=1)] = None,
) -> FeedPage:
    """Next `limit` reels from `cursor`. Positions already served come back unchanged."""
    settings = get_settings()
    limit = min(limit or settings.feed_default_batch, settings.feed_max_batch)
    reels = await available_reels(db)
    if not reels:
        return FeedPage(items=[], next_cursor=None)
    by_id = {r.id: r for r in reels}

    if session_id is None:
        # no session: plain deterministic order
        page = reels[cursor : cursor + limit]
        next_cursor = cursor + len(page) if cursor + len(page) < len(reels) else None
        return FeedPage(items=[to_reel_out(r, False) for r in page], next_cursor=next_cursor)

    session = await get_session_or_404(db, session_id)
    # single stream for now, the column leaves room for an A/B variant
    stream = "main"
    all_served = list(
        await db.scalars(
            select(ReelImpression).where(ReelImpression.session_id == session_id).order_by(ReelImpression.id)
        )
    )
    taken = {i.position: i.reel_id for i in all_served if i.stream == stream}
    wanted = range(cursor, cursor + limit)
    missing = [p for p in wanted if p not in taken]

    if missing:
        events = list(live_state.events_by_session.get(session_id, []))
        ctx = SelectionContext(
            session_id=session_id,
            engagement=assess(views_from_events(events, by_id)),
            latest_bri=await _latest_bri(db, session_id),
            served_ids=[i.reel_id for i in all_served],
            seed=stable_hash(f"{session_id}:{stream}:{cursor}"),
        )
        picked, reason = select_batch(reels, ctx, len(missing))
        db.add_all(
            ReelImpression(
                session_id=session_id,
                reel_id=r.id,
                stream=stream,
                position=pos,
                served_at_ms=now_ms(),
                reason=reason,
            )
            for pos, r in zip(missing, picked, strict=False)
        )
        try:
            await db.commit()
            taken.update({pos: r.id for pos, r in zip(missing, picked, strict=False)})
        # a parallel request filled these positions first, read theirs back
        except IntegrityError:
            await db.rollback()
            rows = await db.execute(
                select(ReelImpression.position, ReelImpression.reel_id).where(
                    ReelImpression.session_id == session_id,
                    ReelImpression.stream == stream,
                    ReelImpression.position >= cursor,
                    ReelImpression.position < cursor + limit,
                )
            )
            taken.update(dict(rows.tuples().all()))

    page_ids = [taken[p] for p in wanted if p in taken]
    liked = await _liked_ids(db, session.subject_name)
    items = [to_reel_out(by_id[rid], rid in liked) for rid in page_ids if rid in by_id]
    return FeedPage(items=items, next_cursor=cursor + limit if items else None)


@router.post("/{reel_id}/like", response_model=ToggleLikeOut)
async def toggle_like(reel_id: str, body: ToggleLikeIn, db: DbDep) -> ToggleLikeOut:
    reel = await get_reel(db, reel_id)
    if reel is None:
        raise HTTPException(404, f"Reel {reel_id} not found")
    session = await get_session_or_404(db, body.session_id)
    stmt = insert(Like).values(
        subject_name=session.subject_name, reel_id=reel_id, liked=body.like, updated_at_ms=now_ms()
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[Like.subject_name, Like.reel_id],
        set_={"liked": body.like, "updated_at_ms": now_ms()},
    )
    await db.execute(stmt)
    await db.commit()
    return ToggleLikeOut(
        reel_id=reel_id, liked_by_me=body.like, likes=base_likes(reel) + (1 if body.like else 0)
    )


@router.get("/stats/served", include_in_schema=False)
async def served_count(db: DbDep) -> dict:
    return {"served": await db.scalar(select(func.count(ReelImpression.id)))}
