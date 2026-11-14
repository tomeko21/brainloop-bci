/** All data collection rates in one place. */
export const TRACKING = {
  /** How many times per second we compute face features (MediaPipe). 10 Hz = good performance/data trade-off. */
  faceSampleHz: 10,
  /** How often (ms) we record a scroll speed sample (only while the user is scrolling). */
  scrollSampleMs: 100,
  /** How often (ms) the feed sends a heartbeat to the admin panel. */
  heartbeatMs: 2_000,
  /** Reel playback clock tick. */
  playbackTickMs: 100,
  /** Window (ms) for blink rate and PERCLOS. */
  eyeWindowMs: 60_000,
} as const;

/**
 * Model MediaPipe Face Landmarker (.task).
 * Offline: download the file to public/models/face_landmarker.task and set
 * VITE_FACE_MODEL_URL=/models/face_landmarker.task
 */
export const FACE_MODEL_URL =
  import.meta.env.VITE_FACE_MODEL_URL ??
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

/** WASM files copied from node_modules by scripts/copy-mediapipe.mjs */
export const MEDIAPIPE_WASM_URL = import.meta.env.VITE_MEDIAPIPE_WASM_URL ?? "/mediapipe/wasm";
