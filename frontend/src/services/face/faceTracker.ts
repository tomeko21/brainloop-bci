/**
 * Face tracking with MediaPipe Face Landmarker on the camera stream.
 * Singleton outside React (like cameraRecorder), works independently of the screen.
 *
 * Performance:
 *  - detection only TRACKING.faceSampleHz times/s (default 10), not on every frame,
 *  - GPU delegate (CPU fallback), model loaded lazily (separate JS chunk),
 *  - forehead color computed from a 160 px thumbnail, UI refreshed 2x/s.
 */
import type { FaceLandmarker, FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { FACE_MODEL_URL, MEDIAPIPE_WASM_URL, TRACKING } from "@/config/tracking";
import { stamp } from "@/lib/timebase";
import { faceTable } from "@/services/dataLogger/tables";
import { logEvent } from "@/store/csvLogStore";
import { useFaceStore } from "@/store/faceStore";
import type { FaceRow } from "@/types/domain";
import { BlinkMeter, eyeAspectRatio, headPoseFromMatrix, irisRatio, type Pt } from "./features";
import { LEFT_EYE_EAR, LM, RIGHT_EYE_EAR } from "./landmarks";

let landmarker: FaceLandmarker | null = null;
let loading: Promise<FaceLandmarker> | null = null;
let video: HTMLVideoElement | null = null;
let timer: number | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let lastSummaryAt = 0;
let lastDetectTs = 0;
let frameTimes: number[] = [];
const blink = new BlinkMeter(TRACKING.eyeWindowMs);

async function loadLandmarker(): Promise<FaceLandmarker> {
  const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(new URL(MEDIAPIPE_WASM_URL, location.href).href);
  const create = (delegate: "GPU" | "CPU") =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
  let lm: FaceLandmarker;
  try {
    lm = await create("GPU");
  } catch {
    lm = await create("CPU");
  }
  // Warm-up: the first inference compiles shaders (can take seconds) -
  // we run it right away, not on the first feed frame.
  const warm = document.createElement("canvas");
  warm.width = 64;
  warm.height = 64;
  warm.getContext("2d")?.fillRect(0, 0, 64, 64);
  lm.detectForVideo(warm, performance.now());
  return lm;
}

/** Load and warm up the model ahead of time (e.g. when the user enables the camera on the start screen). */
export function preloadFaceModel(): void {
  loading ??= loadLandmarker();
  loading.catch(() => (loading = null));
}

export const isFaceTrackingRunning = () => timer !== null;

export async function startFaceTracking(stream: MediaStream): Promise<void> {
  if (timer !== null) return;
  // The detection stream must be "live" - detectForVideo needs increasing timestamps
  lastDetectTs = 0;
  const store = useFaceStore.getState();
  store.patch({ status: "loading", error: null });
  try {
    landmarker = await (loading ??= loadLandmarker());

    video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();

    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = Math.round((160 * (video.videoHeight || 480)) / (video.videoWidth || 640));
    ctx = canvas.getContext("2d", { willReadFrequently: true });

    blink.reset();
    frameTimes = [];
    const interval = 1000 / TRACKING.faceSampleHz;
    const loop = () => {
      timer = window.setTimeout(() => {
        try {
          processFrame();
        } catch (e) {
          console.warn("[face] frame error", e);
        }
        if (timer !== null) loop();
      }, interval);
    };
    timer = -1; // mark as started before the first tick
    loop();

    store.patch({ status: "running" });
    logEvent("face_tracker_start", { value: `${TRACKING.faceSampleHz}Hz` });
  } catch (e) {
    loading = null;
    const msg = e instanceof Error ? e.message : "Failed to start MediaPipe";
    store.patch({ status: "error", error: msg });
    logEvent("face_tracker_error", { value: msg });
  }
}

export function stopFaceTracking(): void {
  if (timer !== null && timer !== -1) window.clearTimeout(timer);
  timer = null;
  if (video) {
    video.pause();
    video.srcObject = null;
    video = null;
  }
  useFaceStore.getState().patch({ status: "off", summary: null });
}

function foreheadRgb(lm: Pt[]): [number, number, number] {
  if (!ctx || !video) return [NaN, NaN, NaN];
  const { width: W, height: H } = ctx.canvas;
  ctx.drawImage(video, 0, 0, W, H);
  const c = lm[LM.foreheadMid];
  const eyeDist = Math.abs(lm[LM.leftEyeOuter].x - lm[LM.rightEyeOuter].x) * W;
  const w = Math.max(4, Math.round(eyeDist * 0.5));
  const h = Math.max(3, Math.round(eyeDist * 0.2));
  const x = Math.round(c.x * W - w / 2);
  const y = Math.round(c.y * H - h / 2);
  if (x < 0 || y < 0 || x + w > W || y + h > H) return [NaN, NaN, NaN];
  const data = ctx.getImageData(x, y, w, h).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  const n = data.length / 4;
  return [r / n, g / n, b / n];
}

const bs = (res: FaceLandmarkerResult, name: string) =>
  res.faceBlendshapes[0]?.categories.find((c) => c.categoryName === name)?.score ?? NaN;

const EMPTY_POINTS = Object.fromEntries(
  ["nose_x", "nose_y", "nose_z", "chin_x", "chin_y", "forehead_x", "forehead_y",
    "r_eye_outer_x", "r_eye_outer_y", "r_eye_inner_x", "r_eye_inner_y", "l_eye_outer_x", "l_eye_outer_y",
    "l_eye_inner_x", "l_eye_inner_y", "r_iris_x", "r_iris_y", "l_iris_x", "l_iris_y",
    "mouth_left_x", "mouth_left_y", "mouth_right_x", "mouth_right_y", "lip_top_x", "lip_top_y", "lip_bottom_x", "lip_bottom_y",
  ].map((k) => [k, NaN]),
);

function processFrame() {
  if (!landmarker || !video || video.readyState < 2) return;
  const t0 = Math.max(performance.now(), lastDetectTs + 1);
  lastDetectTs = t0;
  const res = landmarker.detectForVideo(video, t0);
  const inferenceMs = performance.now() - t0;
  const now = Date.now();
  frameTimes.push(now);
  while (frameTimes.length && frameTimes[0] < now - 2_000) frameTimes.shift();

  const lm = res.faceLandmarks[0] as Pt[] | undefined;
  let row: FaceRow;

  if (!lm) {
    row = {
      ...stamp(now), face_present: 0, inference_ms: round(inferenceMs, 1),
      ear_left: NaN, ear_right: NaN, ear_avg: NaN, blink_bs_left: NaN, blink_bs_right: NaN, eyes_closed: 0,
      blink_count: blink.total, blink_rate_per_min: round(blink.ratePerMin(now), 2), perclos_60s: round(blink.perclos(), 4),
      gaze_x: NaN, gaze_y: NaN, eye_squint: NaN, jaw_open: NaN, brow_down: NaN,
      head_pitch_deg: NaN, head_yaw_deg: NaN, head_roll_deg: NaN, face_scale: NaN,
      forehead_r: NaN, forehead_g: NaN, forehead_b: NaN,
      ...(EMPTY_POINTS as Pick<FaceRow, "nose_x">),
    } as FaceRow;
  } else {
    const earR = eyeAspectRatio(lm, RIGHT_EYE_EAR);
    const earL = eyeAspectRatio(lm, LEFT_EYE_EAR);
    const ear = (earL + earR) / 2;
    const bsL = bs(res, "eyeBlinkLeft");
    const bsR = bs(res, "eyeBlinkRight");
    const closed = (bsL + bsR) / 2 > 0.45 || ear < 0.18;
    blink.update(now, closed);

    const pose = res.facialTransformationMatrixes[0]
      ? headPoseFromMatrix(res.facialTransformationMatrixes[0].data)
      : { pitch: NaN, yaw: NaN, roll: NaN };
    const gR = irisRatio(lm[LM.rightIris], lm[LM.rightEyeOuter], lm[LM.rightEyeInner], lm[LM.rightEyeTop], lm[LM.rightEyeBottom]);
    const gL = irisRatio(lm[LM.leftIris], lm[LM.leftEyeInner], lm[LM.leftEyeOuter], lm[LM.leftEyeTop], lm[LM.leftEyeBottom]);
    const [fr, fg, fb] = foreheadRgb(lm);
    const p = (i: number) => lm[i];

    row = {
      ...stamp(now),
      face_present: 1,
      inference_ms: round(inferenceMs, 1),
      ear_left: round(earL), ear_right: round(earR), ear_avg: round(ear),
      blink_bs_left: round(bsL), blink_bs_right: round(bsR), eyes_closed: closed ? 1 : 0,
      blink_count: blink.total,
      blink_rate_per_min: round(blink.ratePerMin(now), 2),
      perclos_60s: round(blink.perclos()),
      gaze_x: round((gR.x + gL.x) / 2), gaze_y: round((gR.y + gL.y) / 2),
      eye_squint: round((bs(res, "eyeSquintLeft") + bs(res, "eyeSquintRight")) / 2),
      jaw_open: round(bs(res, "jawOpen")),
      brow_down: round((bs(res, "browDownLeft") + bs(res, "browDownRight")) / 2),
      head_pitch_deg: round(pose.pitch, 2), head_yaw_deg: round(pose.yaw, 2), head_roll_deg: round(pose.roll, 2),
      face_scale: round(Math.abs(p(LM.leftEyeOuter).x - p(LM.rightEyeOuter).x)),
      forehead_r: round(fr, 2), forehead_g: round(fg, 2), forehead_b: round(fb, 2),
      nose_x: round(p(LM.noseTip).x), nose_y: round(p(LM.noseTip).y), nose_z: round(p(LM.noseTip).z ?? NaN),
      chin_x: round(p(LM.chin).x), chin_y: round(p(LM.chin).y),
      forehead_x: round(p(LM.forehead).x), forehead_y: round(p(LM.forehead).y),
      r_eye_outer_x: round(p(LM.rightEyeOuter).x), r_eye_outer_y: round(p(LM.rightEyeOuter).y),
      r_eye_inner_x: round(p(LM.rightEyeInner).x), r_eye_inner_y: round(p(LM.rightEyeInner).y),
      l_eye_outer_x: round(p(LM.leftEyeOuter).x), l_eye_outer_y: round(p(LM.leftEyeOuter).y),
      l_eye_inner_x: round(p(LM.leftEyeInner).x), l_eye_inner_y: round(p(LM.leftEyeInner).y),
      r_iris_x: round(p(LM.rightIris).x), r_iris_y: round(p(LM.rightIris).y),
      l_iris_x: round(p(LM.leftIris).x), l_iris_y: round(p(LM.leftIris).y),
      mouth_left_x: round(p(LM.mouthLeft).x), mouth_left_y: round(p(LM.mouthLeft).y),
      mouth_right_x: round(p(LM.mouthRight).x), mouth_right_y: round(p(LM.mouthRight).y),
      lip_top_x: round(p(LM.lipTop).x), lip_top_y: round(p(LM.lipTop).y),
      lip_bottom_x: round(p(LM.lipBottom).x), lip_bottom_y: round(p(LM.lipBottom).y),
    };
  }

  faceTable.append(row);

  if (now - lastSummaryAt > 500) {
    lastSummaryAt = now;
    useFaceStore.getState().patch({
      summary: {
        present: row.face_present === 1,
        earAvg: row.ear_avg,
        blinkRatePerMin: row.blink_rate_per_min,
        perclos: row.perclos_60s,
        pitchDeg: row.head_pitch_deg,
        yawDeg: row.head_yaw_deg,
        rollDeg: row.head_roll_deg,
        jawOpen: row.jaw_open,
        fps: frameTimes.length / 2,
        inferenceMs: row.inference_ms,
      },
    });
  }
}

function round(v: number, digits = 4): number {
  if (!Number.isFinite(v)) return NaN;
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
