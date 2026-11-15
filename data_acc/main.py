# recording protocol (EEG + webcam, phase labels), writes artifacts/1_sessions/<date>_<subject>/
from __future__ import annotations

import argparse
import csv
import json
import random
import shutil
import subprocess
import time
from pathlib import Path

import cv2

import config as C
import ui
from eeg_device import EegDevice
from face_tracker import FaceTracker


class Aborted(Exception):
    pass


class Events:
    def __init__(self, path: Path) -> None:
        self.f = path.open("w", newline="")
        self.w = csv.writer(self.f)
        self.w.writerow(["ts_ms", "event", "phase", "info"])
        self.phases: list[dict] = []

    def log(self, event: str, phase: str = "", info: str = "") -> float:
        ts = time.time() * 1000.0
        self.w.writerow([f"{ts:.1f}", event, phase, info])
        self.f.flush()
        return ts

    def close(self) -> None:
        self.f.close()


# q aborts (data recorded so far is kept), n skips to the next phase
def _key_check(key: int) -> str | None:
    if key == ord("q"):
        raise Aborted
    if key == ord("n"):
        return "skip"
    return None


# setup screen, waits until enough electrodes stay green for GOOD_CONTACT_HOLD_S
def wait_for_contact(eeg: EegDevice | None, face: FaceTracker) -> None:
    t0 = time.time()
    good_since: float | None = None
    while True:
        if eeg is None:
            quality, ptp, status = {}, {}, "EEG wylaczone (--no-eeg)"
        else:
            quality, ptp = eeg.contact_quality(), eeg.ptp_uv()
            st = eeg.status
            status = f"EEG: {st.get('state')} {st.get('device', '')} {st.get('error', '')}".strip()
            if "battery" in st:
                status += f"  bateria {st['battery']}%"
        need = min(C.REQUIRED_GOOD_CHANNELS, len(quality)) if quality else 0
        n_good = sum(q == "good" for q in quality.values())
        all_ok = eeg is None or (n_good >= need and need > 0)
        if all_ok:
            good_since = good_since or time.time()
        else:
            good_since = None
        hold = time.time() - good_since if good_since else 0.0
        can_force = time.time() - t0 > C.ALLOW_FORCE_START_AFTER_S
        face_ok = bool(face.last.get("face_present"))
        img = ui.setup_screen(
            quality,
            ptp,
            status + f"   kamera {face.fps:.0f} fps",
            hold,
            C.GOOD_CONTACT_HOLD_S,
            need,
            face.preview,
            face_ok,
            can_force,
        )
        key = ui.show(img, 30)
        _key_check(key)
        if hold >= C.GOOD_CONTACT_HOLD_S or (can_force and key == ord("s")):
            return


def intro(phase: dict) -> None:
    ui.beep()
    end = time.time() + C.INTRO_SECONDS
    while (left := end - time.time()) > 0:
        img = ui.phase_screen("Za chwile: " + phase["title"], phase["text"], left, big_countdown=True)
        if _key_check(ui.show(img, 30)) == "skip":
            return


def timed_screen(phase: dict, draw) -> None:
    end = time.time() + phase["seconds"]
    while (left := end - time.time()) > 0:
        if _key_check(ui.show(draw(left), 30)) == "skip":
            return


def pick_videos(phase: dict) -> list[Path]:
    files: list[Path] = []
    for d in phase.get("video_dirs", []):
        files += sorted((C.VIDEOS_DIR / d).glob("*.mp4"))
    random.shuffle(files)
    return files


# ffplay full screen with sound if available, otherwise silent OpenCV playback
def play_calm_video(phase: dict, ev: Events) -> None:
    files = pick_videos(phase)
    end = time.time() + phase["seconds"]
    if not files:
        ev.log("warning", phase["id"], f"no videos in {C.VIDEOS_DIR} – showing text instead")
        timed_screen(
            phase,
            lambda left: ui.phase_screen(phase["title"], "Brak filmow – patrz spokojnie na ekran.", left),
        )
        return
    ffplay = shutil.which("ffplay")
    i = 0
    while time.time() < end:
        f = files[i % len(files)]
        i += 1
        ev.log("video_start", phase["id"], f.name)
        if ffplay:
            proc = subprocess.Popen([ffplay, "-fs", "-autoexit", "-loglevel", "quiet", str(f)])
            while proc.poll() is None and time.time() < end:
                img = ui.phase_screen(phase["title"], "Film leci w osobnym oknie.", end - time.time())
                key = ui.show(img, 100)
                if key == ord("q"):
                    proc.terminate()
                    raise Aborted
                if key == ord("n"):
                    proc.terminate()
                    return
            if proc.poll() is None:
                proc.terminate()
        else:
            cap = cv2.VideoCapture(str(f))
            fps = cap.get(cv2.CAP_PROP_FPS) or 30
            while time.time() < end:
                ok, frame = cap.read()
                if not ok:
                    break
                frame = cv2.resize(frame, (ui.W, int(frame.shape[0] * ui.W / frame.shape[1])))
                img = ui.canvas()
                y = max(0, (ui.H - frame.shape[0]) // 2)
                img[y : y + min(frame.shape[0], ui.H)] = frame[: ui.H]
                if _key_check(ui.show(img, max(1, int(1000 / fps)))) == "skip":
                    cap.release()
                    return
            cap.release()


def external_phase(phase: dict) -> None:
    ui.beep(2)
    timed_screen(phase, lambda left: ui.phase_screen(phase["title"], phase["text"], left))
    ui.beep(3)


def run_phase(phase: dict, ev: Events) -> None:
    kind = phase["kind"]
    if kind != "external" and phase["id"] != "insta_prep":
        intro(phase)
    start = ev.log("phase_start", phase["id"], phase["title"])
    if kind == "cross":
        cross = ui.fixation_cross()
        timed_screen(phase, lambda _left: cross)
    elif kind == "video":
        play_calm_video(phase, ev)
    elif kind == "external":
        external_phase(phase)
    elif phase["id"] == "insta_prep":
        ui.beep()
        timed_screen(
            phase, lambda left: ui.phase_screen(phase["title"], phase["text"], left, big_countdown=True)
        )
    else:
        timed_screen(phase, lambda left: ui.phase_screen(phase["title"], phase["text"], left))
    end = ev.log("phase_end", phase["id"])
    ev.phases.append({"id": phase["id"], "start_ms": start, "end_ms": end, "planned_s": phase["seconds"]})


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--subject", required=True, help="name / id of the person")
    ap.add_argument("--eeg", choices=["direct", "board"], default=C.EEG_MODE)
    ap.add_argument("--device", default=C.EEG_DEVICE, help="headset name, e.g. 'BA MINI 074'")
    ap.add_argument("--no-eeg", action="store_true", help="camera only (protocol test)")
    ap.add_argument("--windowed", action="store_true", help="no full screen")
    ap.add_argument("--short", action="store_true", help="every phase 8 s (quick test)")
    args = ap.parse_args()

    folder = C.SESSIONS_DIR / f"{time.strftime('%Y-%m-%d_%H-%M-%S')}_{args.subject}"
    folder.mkdir(parents=True, exist_ok=True)
    phases = [dict(p, seconds=8 if args.short else p["seconds"]) for p in C.PHASES]

    eeg = None if args.no_eeg else EegDevice(args.eeg, args.device)
    if eeg:
        eeg.start()
    face = FaceTracker()
    ui.open_window(not args.windowed)
    ev = Events(folder / "events.csv")
    meta: dict = {
        "subject": args.subject,
        "eeg_mode": None if args.no_eeg else args.eeg,
        "created": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "phases": ev.phases,
        "config": {"phases": phases, "channel_names": C.EEG_CHANNEL_NAMES},
    }
    aborted = False
    try:
        ev.log("setup_start", "setup")
        wait_for_contact(eeg, face)
        ev.log("setup_done", "setup", json.dumps(eeg.contact_quality() if eeg else {}))
        # start recording only after the contact check so the csvs hold just the protocol
        if eeg:
            eeg.start_recording(folder / "eeg_raw.csv")
        face.start_recording(folder)
        ev.log("recording_start")
        for p in phases:
            run_phase(p, ev)
        ev.log("recording_end")
        img = ui.phase_screen("KONIEC", "Dziekujemy! Dane zapisane. Mozesz zdjac opaske.", None)
        ui.show(img, 2500)
    except Aborted:
        aborted = True
        ev.log("aborted")
    finally:
        face.stop()
        if eeg:
            meta["eeg_status"] = eeg.status
            meta["eeg_fs"] = eeg.fs
            meta["eeg_channels"] = eeg.names
            meta["eeg_samples"] = eeg.samples_written
            eeg.stop()
        meta["aborted"] = aborted
        meta["camera_frames"] = face.frames
        ev.close()
        (folder / "meta.json").write_text(json.dumps(meta, indent=2, default=str))
        cv2.destroyAllWindows()
    print(f"\nSaved: {folder}")
    print(
        "Next:  uv run python process.py   (all new sessions)  ->  uv run python analyze.py  ->  "
        "uv run python train_ml.py"
    )


if __name__ == "__main__":
    main()
