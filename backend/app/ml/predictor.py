"""BRI from the CAMERA (without the EEG headset) – NOT IMPLEMENTED YET (no fake scores).

What exists already (real data, collected in every session):
  - browser MediaPipe face features + scroll/viewing behaviour -> MlFeatureWindow every 2 s,
  - server-side OpenCV analysis of camera frames -> VideoFeatures (app/ml/video_features.py),
  - the EEG BRI at the same moment (label) -> stored together in the `windows` table and ml_windows.csv.

TODO(team): train a model on (features -> bri_eeg) and implement `CameraBriModel.predict`.
Full contract: see TODO.md in the repo root ("Camera BRI model").
Until then `predict` returns None and the app uses the EEG BRI only.
"""

from __future__ import annotations

from app.schemas import MlFeatureWindow, VideoFeatures

# Version string shown in the admin panel / stored with every window
MODEL_VERSION = "not-trained"


class CameraBriModel:
    """Predicts BRI (0..100) from camera + scroll features. Swap in the trained model here."""

    version = MODEL_VERSION

    def predict(self, window: MlFeatureWindow, video: VideoFeatures | None) -> float | None:
        """Return BRI 0..100 for the last 10 s, or None when the model cannot/does not predict.

        TODO(team): load the trained artifact (e.g. LightGBM .joblib from data/models/) once in __init__,
        build the feature vector in the SAME order as used in training (MlFeatureWindow fields +
        VideoFeatures fields; None -> NaN) and return `model.predict(...)` clipped to 0..100.
        """
        return None


_model = CameraBriModel()


def get_predictor() -> CameraBriModel:
    return _model
