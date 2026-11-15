# OpenCV screens for the protocol. cv2.putText is ASCII only, hence no Polish diacritics
from __future__ import annotations

import platform
import shutil
import subprocess
import textwrap

import cv2
import numpy as np

WIN = "BrainRot data acquisition"
W, H = 1280, 720
FONT = cv2.FONT_HERSHEY_SIMPLEX
BG = (25, 25, 25)
FG = (235, 235, 235)
GREEN, RED, GRAY, YELLOW = (60, 200, 60), (40, 40, 230), (120, 120, 120), (0, 200, 230)


def open_window(fullscreen: bool = True) -> None:
    cv2.namedWindow(WIN, cv2.WINDOW_NORMAL)
    if fullscreen:
        cv2.setWindowProperty(WIN, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)
    else:
        cv2.resizeWindow(WIN, W, H)


def canvas() -> np.ndarray:
    return np.full((H, W, 3), BG, np.uint8)


def text_c(img: np.ndarray, s: str, y: int, scale: float = 1.0, color=FG, thick: int = 2) -> None:
    (tw, _), _ = cv2.getTextSize(s, FONT, scale, thick)
    cv2.putText(img, s, ((W - tw) // 2, y), FONT, scale, color, thick, cv2.LINE_AA)


def paragraph(img: np.ndarray, s: str, y: int, scale: float = 0.9, width: int = 52) -> int:
    for line in textwrap.wrap(s, width):
        text_c(img, line, y, scale, FG, 2)
        y += int(48 * scale)
    return y


def show(img: np.ndarray, wait_ms: int = 15) -> int:
    cv2.imshow(WIN, img)
    return cv2.waitKey(wait_ms) & 0xFF


def fixation_cross() -> np.ndarray:
    img = canvas()
    c, L, t = (W // 2, H // 2), 40, 6
    cv2.line(img, (c[0] - L, c[1]), (c[0] + L, c[1]), FG, t)
    cv2.line(img, (c[0], c[1] - L), (c[0], c[1] + L), FG, t)
    return img


def phase_screen(title: str, text: str, remaining: float | None, big_countdown: bool = False) -> np.ndarray:
    img = canvas()
    text_c(img, title, 200, 1.8, YELLOW, 4)
    paragraph(img, text, 300)
    if remaining is not None:
        if big_countdown:
            text_c(img, f"{int(np.ceil(remaining))}", 600, 4.0, YELLOW, 8)
        else:
            m, s = divmod(int(np.ceil(remaining)), 60)
            text_c(img, f"{m:02d}:{s:02d}", 640, 1.2, GRAY, 2)
    return img


def setup_screen(
    quality: dict[str, str],
    ptp: dict[str, float],
    status: str,
    hold: float,
    hold_need: float,
    n_good_need: int,
    preview: np.ndarray | None,
    face_ok: bool,
    can_force: bool,
) -> np.ndarray:
    img = canvas()
    text_c(img, "SPRAWDZANIE ELEKTROD", 70, 1.4, YELLOW, 3)
    text_c(img, status, 115, 0.7, GRAY, 1)
    names = list(quality)
    n = max(1, len(names))
    gap = min(130, (W - 200) // n)
    x0 = (W - gap * (n - 1)) // 2
    for i, name in enumerate(names):
        q = quality[name]
        col = GREEN if q == "good" else (GRAY if q == "nodata" else RED)
        cx = x0 + i * gap
        cv2.circle(img, (cx, 210), 32, col, -1)
        (tw, _), _ = cv2.getTextSize(name, FONT, 0.8, 2)
        cv2.putText(img, name, (cx - tw // 2, 275), FONT, 0.8, FG, 2, cv2.LINE_AA)
        if name in ptp:
            s = f"{ptp[name]:.0f}uV"
            (tw, _), _ = cv2.getTextSize(s, FONT, 0.5, 1)
            cv2.putText(img, s, (cx - tw // 2, 300), FONT, 0.5, GRAY, 1, cv2.LINE_AA)
    n_good = sum(q == "good" for q in quality.values())
    text_c(
        img,
        f"Zielone: {n_good}/{len(names)} (potrzeba {n_good_need})   stabilnie: {hold:.1f}/{hold_need:.0f} s",
        350,
        0.8,
        GREEN if n_good >= n_good_need else RED,
        2,
    )
    text_c(img, "Popraw elektrody az wszystkie beda zielone. Siedz spokojnie.", 395, 0.7, FG, 1)
    if preview is not None:
        ph = 260
        pw = int(preview.shape[1] * ph / preview.shape[0])
        small = cv2.resize(preview, (pw, ph))
        x = (W - pw) // 2
        img[420 : 420 + ph, x : x + pw] = small
        cv2.rectangle(img, (x, 420), (x + pw, 420 + ph), GREEN if face_ok else RED, 3)
    hint = "q = wyjscie" + ("   s = start mimo czerwonych" if can_force else "")
    cv2.putText(img, hint, (20, H - 15), FONT, 0.55, GRAY, 1, cv2.LINE_AA)
    return img


def beep(times: int = 1) -> None:
    if platform.system() == "Darwin" and shutil.which("afplay"):
        snd = "/System/Library/Sounds/Glass.aiff"
        cmd = " ; ".join([f"afplay {snd}"] * times)
        subprocess.Popen(["sh", "-c", cmd], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        print("\a" * times, end="", flush=True)
