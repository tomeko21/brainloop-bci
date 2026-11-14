/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** "false" = use the real backend instead of mocks */
  readonly VITE_USE_MOCKS?: string;
  /** EEG stream transport from FastAPI: "sse" (StreamingResponse + yield) or "ws" */
  readonly VITE_EEG_TRANSPORT?: "sse" | "ws";
  readonly VITE_FACE_MODEL_URL?: string;
  readonly VITE_MEDIAPIPE_WASM_URL?: string;
}
