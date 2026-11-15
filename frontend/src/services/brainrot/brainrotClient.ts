// One WebSocket to the backend Brain Rot engine (/ws/brainrot, backend app/brainrot). Sends raw MediaPipe frames
// in small batches and receives the BRI state (every 0.5 s) into useBrainrotStore.
import { http, wsUrl } from "@/api/client";
import { useBrainrotStore } from "@/store/brainrotStore";
import type { BrainrotState, FaceFrameOut } from "@/types/domain";

const FLUSH_MS = 200;  // ms
const MAX_BUFFER = 300;  // frames kept while the socket is down, ~10 s at 30 Hz

let ws: WebSocket | null = null;
let started = false;
let attempt = 0;
let buffer: FaceFrameOut[] = [];
let flushTimer: number | null = null;

function open() {
  const store = useBrainrotStore.getState();
  store.setStatus(attempt === 0 ? "connecting" : "reconnecting");
  ws = new WebSocket(wsUrl("/ws/brainrot"));
  ws.onopen = () => {
    attempt = 0;
    useBrainrotStore.getState().setStatus("open");
  };
  ws.onmessage = (e) => {
    try {
      useBrainrotStore.getState().push(JSON.parse(e.data as string) as BrainrotState);
    } catch {
      // malformed message, skip
    }
  };
  ws.onclose = () => {
    ws = null;
    attempt++;
    useBrainrotStore.getState().setStatus("reconnecting");
    window.setTimeout(open, Math.min(5_000, 300 * 2 ** attempt));
  };
}

function flush() {
  if (!buffer.length || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "face", frames: buffer }));
  buffer = [];
}

// idempotent, shared by the feed, admin panel and calm filter
export function ensureBrainrotConnection(): void {
  if (started) return;
  started = true;
  open();
  flushTimer = window.setInterval(flush, FLUSH_MS);
}

export function pushFaceFrame(frame: FaceFrameOut): void {
  ensureBrainrotConnection();
  buffer.push(frame);
  if (buffer.length > MAX_BUFFER) buffer.splice(0, buffer.length - MAX_BUFFER);
}

// start = cross on screen (backend skips the first 15 s), finish = compute the baseline
export function brainrotBaseline(step: "start" | "finish") {
  return http<{ ok: boolean; windows?: number; features?: number; mode: string }>(`/api/brainrot/baseline/${step}`, {
    method: "POST",
  });
}

export const isBrainrotFlushing = () => flushTimer !== null;
