"""Health check: database, number of reels / available videos, camera model version."""

from fastapi import APIRouter
from sqlalchemy import func, select

from app.deps import DbDep
from app.ml.predictor import get_predictor
from app.models import Reel
from app.schemas import HealthOut
from app.services.catalog import available_reels

router = APIRouter(tags=["health"])


@router.get("/api/health", response_model=HealthOut)
async def health(db: DbDep) -> HealthOut:
    try:
        total = await db.scalar(select(func.count()).select_from(Reel)) or 0
        active = len(await available_reels(db))
        db_ok = True
    except Exception:
        total = active = 0
        db_ok = False
    return HealthOut(
        status="ok" if db_ok and active else "degraded",
        db=db_ok,
        reels=total,
        active_reels=active,
        model_version=get_predictor().version,
    )
