/** Data collection rates live in ./tuning.ts – re-exported here for existing imports. */
export { TRACKING } from "./tuning";

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
