/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;  // only when the API is on another host, dev uses the Vite proxy
  readonly VITE_EEG_TRANSPORT?: "sse" | "ws";  // sse by default
  readonly VITE_FACE_MODEL_URL?: string;
  readonly VITE_MEDIAPIPE_WASM_URL?: string;
}
