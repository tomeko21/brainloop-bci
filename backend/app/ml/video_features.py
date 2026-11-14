"""Server-side features from camera frames (JPEG, ~2 fps) sent by the frontend.

Cheap OpenCV only (Haar face detector), so it runs in real time on a laptop CPU:
  - face present + face box area (proxy for distance to the screen),
  - brightness, motion (mean abs difference to the previous frame of the same session),
  - mean forehead RGB (input for rPPG / heart rate – see the architecture doc, app/ml/rppg.py).
The browser already runs MediaPipe; this is the server's independent view + training data.

TODO(team): heart rate (rPPG). The mean forehead RGB is collected here (per frame batch) and in the
browser (face.csv: forehead_r/g/b at 10 Hz). Turning it into BPM is not implemented – contract in TODO.md.
"""

from dataclasses import dataclass

import cv2
import numpy as np

_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")


@dataclass
class FrameResult:
    ts_ms: int
    face: bool
    brightness: float
    motion: float | None
    face_area: float | None
    forehead_rgb: tuple[float, float, float] | None


class SessionFrameAnalyzer:
    """Keeps the previous frame of one session to measure motion."""

    def __init__(self) -> None:
        self._prev_gray: np.ndarray | None = None

    def analyze(self, jpeg: bytes, ts_ms: int) -> FrameResult | None:
        img = cv2.imdecode(np.frombuffer(jpeg, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            return None
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        small = cv2.resize(gray, (160, 120))
        motion = None
        if self._prev_gray is not None and self._prev_gray.shape == small.shape:
            motion = float(np.mean(cv2.absdiff(small, self._prev_gray)))
        self._prev_gray = small

        faces = _cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=(40, 40))
        face_area = None
        forehead = None
        if len(faces):
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
            face_area = float(w * h) / float(gray.shape[0] * gray.shape[1])
            # Forehead ROI (same geometry as the rPPG prototype)
            x0, x1 = x + int(0.28 * w), x + int(0.72 * w)
            y0, y1 = y + int(0.08 * h), y + int(0.24 * h)
            roi = img[y0:y1, x0:x1]
            if roi.size:
                b, g, r = roi.reshape(-1, 3).mean(axis=0)
                forehead = (round(float(r), 2), round(float(g), 2), round(float(b), 2))

        return FrameResult(
            ts_ms=ts_ms,
            face=len(faces) > 0,
            brightness=float(gray.mean()),
            motion=motion,
            face_area=face_area,
            forehead_rgb=forehead,
        )


def aggregate(results: list[FrameResult]) -> dict:
    """Window summary used by the predictor and shown in the admin panel."""
    if not results:
        return {}
    faces = [r for r in results if r.face]
    motions = [r.motion for r in results if r.motion is not None]
    areas = [r.face_area for r in faces if r.face_area is not None]
    rgbs = [r.forehead_rgb for r in faces if r.forehead_rgb is not None]
    return {
        "frames": len(results),
        "face_present_ratio": len(faces) / len(results),
        "brightness": float(np.mean([r.brightness for r in results])),
        "motion": float(np.mean(motions)) if motions else 0.0,
        "face_area": float(np.mean(areas)) if areas else None,
        "forehead_rgb": tuple(float(v) for v in np.mean(rgbs, axis=0)) if rgbs else None,
        "window_start_ms": results[0].ts_ms,
        "window_end_ms": results[-1].ts_ms,
    }
