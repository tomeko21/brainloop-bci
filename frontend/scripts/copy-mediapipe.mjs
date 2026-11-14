// Copies the MediaPipe WASM files to public/ so the face tracker works offline (no CDN).
import { cpSync, existsSync, mkdirSync } from "node:fs";

const src = "node_modules/@mediapipe/tasks-vision/wasm";
const dest = "public/mediapipe/wasm";
if (existsSync(src)) {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log("[mediapipe] wasm copied to", dest);
}
