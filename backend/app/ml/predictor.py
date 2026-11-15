"""Camera-only BRI model. Not trained yet, predict returns None and callers fall back to the EEG BRI."""

from __future__ import annotations

from app.schemas import MlFeatureWindow, VideoFeatures

MODEL_VERSION = "not-trained"  # shown in /api/health and stored with every window


class CameraBriModel:
    version = MODEL_VERSION

    def predict(self, window: MlFeatureWindow, video: VideoFeatures | None) -> float | None:
        return None


_model = CameraBriModel()


def get_predictor() -> CameraBriModel:
    return _model
