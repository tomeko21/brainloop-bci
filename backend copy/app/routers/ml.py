"""Per-window BRI prediction. Every window is also stored as training data."""

from fastapi import APIRouter

from app.deps import DbDep, get_session_or_404
from app.eeg.hub import get_hub
from app.ml.predictor import get_predictor
from app.models import Window
from app.schemas import MlFeatureWindow, MlPrediction
from app.services.live_state import live_state
from app.utils import now_ms

router = APIRouter(prefix="/api/ml", tags=["ml"])


STOP_THRESHOLD = 70.0  # BRI above this sets shouldStop


@router.post("/predict-window", response_model=MlPrediction)
async def predict_window(body: MlFeatureWindow, db: DbDep) -> MlPrediction:
    """Called by the feed every ~2 s. Camera BRI stays None until a model is trained."""
    await get_session_or_404(db, body.session_id)
    video = live_state.video_by_session.get(body.session_id)
    model = get_predictor()
    bri_ai = model.predict(body, video)
    # None when the headset isn't streaming right now
    eeg = get_hub().fresh_latest()
    bri_eeg = eeg.get("bri") if eeg else None
    best = bri_ai if bri_ai is not None else bri_eeg
    prediction = MlPrediction(
        bri=bri_ai,
        bri_eeg=bri_eeg,
        should_stop=best is not None and best > STOP_THRESHOLD,
        model_version=model.version,
        top_factors=[],
        predicted_at_ms=now_ms(),
    )

    db.add(
        Window(
            session_id=body.session_id,
            ts_ms=prediction.predicted_at_ms,
            client_features=body.model_dump(mode="json", exclude={"session_id"}),
            video_features=video.model_dump(mode="json") if video else None,
            bri_ai=bri_ai,
            bri_eeg=bri_eeg,
            should_stop=prediction.should_stop,
            model_version=prediction.model_version,
        )
    )
    await db.commit()
    live_state.prediction_by_session[body.session_id] = prediction
    return prediction
