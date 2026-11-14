/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Only when the API is on another host than the frontend (dev uses the Vite proxy). */
  readonly VITE_API_URL?: string;
  /** EEG stream transport from FastAPI: "sse" (StreamingResponse + yield) or "ws" */
  readonly VITE_EEG_TRANSPORT?: "sse" | "ws";
  readonly VITE_FACE_MODEL_URL?: string;
  readonly VITE_MEDIAPIPE_WASM_URL?: string;
}
