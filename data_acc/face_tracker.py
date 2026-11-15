# webcam + MediaPipe Face Landmarker, one face.csv row per frame (blendshapes + derived features)
from __future__ import annotations

import csv
import threading
import time
import urllib.request
from pathlib import Path
from typing import Any

import cv2
import numpy as np

import config as C

# MediaPipe face mesh indices, image-right eye is the person's right eye
R_EYE = [33, 160, 158, 133, 153, 144]
L_EYE = [362, 385, 387, 263, 373, 380]
R_IRIS, L_IRIS = 468, 473
R_TOP, R_BOT, L_TOP, L_BOT = 159, 145, 386, 374
NOSE, CHIN, FOREHEAD = 1, 152, 10

BLENDSHAPES = [
    "_neutral",
    "browDownLeft",
    "browDownRight",
    "browInnerUp",
    "browOuterUpLeft",
    "browOuterUpRight",
    "cheekPuff",
    "cheekSquintLeft",
    "cheekSquintRight",
    "eyeBlinkLeft",
    "eyeBlinkRight",
    "eyeLookDownLeft",
    "eyeLookDownRight",
    "eyeLookInLeft",
    "eyeLookInRight",
    "eyeLookOutLeft",
    "eyeLookOutRight",
    "eyeLookUpLeft",
    "eyeLookUpRight",
    "eyeSquintLeft",
    "eyeSquintRight",
    "eyeWideLeft",
    "eyeWideRight",
    "jawForward",
    "jawLeft",
    "jawOpen",
    "jawRight",
    "mouthClose",
    "mouthDimpleLeft",
    "mouthDimpleRight",
    "mouthFrownLeft",
    "mouthFrownRight",
    "mouthFunnel",
    "mouthLeft",
    "mouthLowerDownLeft",
    "mouthLowerDownRight",
    "mouthPressLeft",
    "mouthPressRight",
    "mouthPucker",
    "mouthRight",
    "mouthRollLower",
    "mouthRollUpper",
    "mouthShrugLower",
    "mouthShrugUpper",
    "mouthSmileLeft",
    "mouthSmileRight",
    "mouthStretchLeft",
    "mouthStretchRight",
    "mouthUpperUpLeft",
    "mouthUpperUpRight",
    "noseSneerLeft",
    "noseSneerRight",
]

DERIVED = [
    "ear_left",
    "ear_right",
    "ear_avg",
    "eyes_closed",
    "blink_bs",
    "gaze_x",
    "gaze_y",
    "head_yaw_deg",
    "head_pitch_deg",
    "head_roll_deg",
    "brow_furrow",
    "brow_raise",
    "eye_squint",
    "eye_wide",
    "jaw_open",
    "smile",
    "mouth_frown",
    "nose_x",
    "nose_y",
    "face_scale",
]
COLUMNS = ["ts_ms", "frame_idx", "face_present", "inference_ms", *DERIVED, *[f"bs_{b}" for b in BLENDSHAPES]]


def ensure_model() -> Path:
    if not C.FACE_MODEL_PATH.exists():
        C.FACE_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        print(f"[face] downloading MediaPipe model -> {C.FACE_MODEL_PATH}")
        urllib.request.urlretrieve(C.FACE_MODEL_URL, C.FACE_MODEL_PATH)
    return C.FACE_MODEL_PATH


def _ear(p: np.ndarray, idx: list[int]) -> float:
    a = np.linalg.norm(p[idx[1]] - p[idx[5]])
    b = np.linalg.norm(p[idx[2]] - p[idx[4]])
    c = np.linalg.norm(p[idx[0]] - p[idx[3]]) + 1e-9
    return float((a + b) / (2 * c))


def _head_pose(m: np.ndarray) -> tuple[float, float, float]:
    r = m[:3, :3]
    sy = np.hypot(r[0, 0], r[1, 0])
    pitch = np.degrees(np.arctan2(r[2, 1], r[2, 2]))
    yaw = np.degrees(np.arctan2(-r[2, 0], sy))
    roll = np.degrees(np.arctan2(r[1, 0], r[0, 0]))
    return float(yaw), float(pitch), float(roll)


# also imported by backend/app/brainrot/engine.py for landmarks sent from the browser
def face_features(lm: Any, bs: dict[str, float], matrix: np.ndarray | None, w: int, h: int) -> dict:
    p = np.array([[q.x * w, q.y * h] for q in lm])  # pixels, so the ratios are aspect-correct
    ear_r, ear_l = _ear(p, R_EYE), _ear(p, L_EYE)
    ear = (ear_r + ear_l) / 2

    def gaze(iris: int, a: int, b: int, top: int, bot: int) -> tuple[float, float]:
        ex = p[b] - p[a]
        gx = float(np.dot(p[iris] - p[a], ex) / (np.dot(ex, ex) + 1e-9)) - 0.5
        gy = float((p[iris][1] - p[top][1]) / (p[bot][1] - p[top][1] + 1e-9)) - 0.5
        return gx, gy

    gx_r, gy_r = gaze(R_IRIS, 33, 133, R_TOP, R_BOT)
    gx_l, gy_l = gaze(L_IRIS, 362, 263, L_TOP, L_BOT)
    yaw = pitch = roll = np.nan
    if matrix is not None:
        yaw, pitch, roll = _head_pose(matrix)
    g = bs.get
    return {
        "ear_left": ear_l,
        "ear_right": ear_r,
        "ear_avg": ear,
        "eyes_closed": int(ear < C.EAR_CLOSED),
        "blink_bs": (g("eyeBlinkLeft", 0) + g("eyeBlinkRight", 0)) / 2,
        "gaze_x": (gx_r + gx_l) / 2,
        "gaze_y": (gy_r + gy_l) / 2,
        "head_yaw_deg": yaw,
        "head_pitch_deg": pitch,
        "head_roll_deg": roll,
        "brow_furrow": (g("browDownLeft", 0) + g("browDownRight", 0)) / 2,
        "brow_raise": g("browInnerUp", 0),
        "eye_squint": (g("eyeSquintLeft", 0) + g("eyeSquintRight", 0)) / 2,
        "eye_wide": (g("eyeWideLeft", 0) + g("eyeWideRight", 0)) / 2,
        "jaw_open": g("jawOpen", 0),
        "smile": (g("mouthSmileLeft", 0) + g("mouthSmileRight", 0)) / 2,
        "mouth_frown": (g("mouthFrownLeft", 0) + g("mouthFrownRight", 0)) / 2,
        "nose_x": lm[NOSE].x,
        "nose_y": lm[NOSE].y,
        "face_scale": float(np.linalg.norm(p[FOREHEAD] - p[CHIN]) / h),
    }


class FaceTracker:
    def __init__(self) -> None:
        import mediapipe as mp

        self._mp = mp
        vision = mp.tasks.vision
        opts = vision.FaceLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(ensure_model())),
            running_mode=vision.RunningMode.VIDEO,
            num_faces=1,
            output_face_blendshapes=True,
            output_facial_transformation_matrixes=True,
        )
        self._landmarker = vision.FaceLandmarker.create_from_options(opts)
        self.cap = cv2.VideoCapture(C.CAMERA_INDEX)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, C.CAMERA_WIDTH)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, C.CAMERA_HEIGHT)
        self.cap.set(cv2.CAP_PROP_FPS, C.CAMERA_FPS)
        if not self.cap.isOpened():
            raise RuntimeError("Camera not available (macOS: allow camera access for your terminal)")
        self.preview: np.ndarray | None = None
        self.last: dict = {}
        self.frames = 0
        self.fps = 0.0
        self._stop = threading.Event()
        self._rec_lock = threading.Lock()
        self._csv: Any = None
        self._csv_f: Any = None
        self._video: cv2.VideoWriter | None = None
        self._frame_idx = 0
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def start_recording(self, folder: Path) -> None:
        with self._rec_lock:
            self._csv_f = (folder / "face.csv").open("w", newline="")
            self._csv = csv.DictWriter(self._csv_f, fieldnames=COLUMNS, extrasaction="ignore")
            self._csv.writeheader()
            self._frame_idx = 0
            if C.SAVE_VIDEO:
                w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                self._video = cv2.VideoWriter(
                    str(folder / "video.mp4"), cv2.VideoWriter_fourcc(*"mp4v"), C.CAMERA_FPS, (w, h)
                )

    def stop_recording(self) -> None:
        with self._rec_lock:
            if self._csv_f:
                self._csv_f.close()
            if self._video is not None:
                self._video.release()
            self._csv = self._csv_f = self._video = None

    def stop(self) -> None:
        self._stop.set()
        self._thread.join(timeout=3)
        self.stop_recording()
        self.cap.release()

    def _run(self) -> None:
        mp = self._mp
        last_ts = 0
        t_fps, n_fps = time.time(), 0
        while not self._stop.is_set():
            ok, frame = self.cap.read()
            ts_ms = time.time() * 1000.0
            if not ok:
                time.sleep(0.01)
                continue
            h, w = frame.shape[:2]
            t0 = time.perf_counter()
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mono = max(last_ts + 1, int(ts_ms))  # VIDEO mode needs strictly increasing timestamps
            last_ts = mono
            res = self._landmarker.detect_for_video(
                mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), mono
            )
            inf_ms = (time.perf_counter() - t0) * 1000
            row: dict = {"ts_ms": f"{ts_ms:.1f}", "face_present": 0, "inference_ms": round(inf_ms, 1)}
            if res.face_landmarks:
                lm = res.face_landmarks[0]
                bs = (
                    {c.category_name: c.score for c in res.face_blendshapes[0]}
                    if res.face_blendshapes
                    else {}
                )
                mat = (
                    np.array(res.facial_transformation_matrixes[0])
                    if res.facial_transformation_matrixes
                    else None
                )
                feats = face_features(lm, bs, mat, w, h)
                row.update({k: (round(v, 5) if isinstance(v, float) else v) for k, v in feats.items()})
                row.update({f"bs_{k}": round(v, 5) for k, v in bs.items()})
                row["face_present"] = 1
                for i in (*R_EYE, *L_EYE, R_IRIS, L_IRIS, NOSE):
                    cv2.circle(frame, (int(lm[i].x * w), int(lm[i].y * h)), 2, (0, 255, 0), -1)
            with self._rec_lock:
                if self._csv is not None:
                    row["frame_idx"] = self._frame_idx
                    self._csv.writerow(row)
                    if self._video is not None:
                        self._video.write(
                            frame if not res.face_landmarks else self._raw(rgb)
                        )  # video without the drawn landmarks
                    self._frame_idx += 1
            self.last = row
            self.preview = frame
            self.frames += 1
            n_fps += 1
            if time.time() - t_fps >= 1.0:
                self.fps = n_fps / (time.time() - t_fps)
                t_fps, n_fps = time.time(), 0

    @staticmethod
    def _raw(rgb: np.ndarray) -> np.ndarray:
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
