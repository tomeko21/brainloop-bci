/**
 * Singleton that records the camera (NO AUDIO) via MediaRecorder.
 * Lives outside React, so recording continues while navigating between screens.
 * Every chunk (each 1 s) goes straight to IndexedDB, so a reload does not delete the recording.
 */
import { useRecordingStore } from "@/store/recordingStore";
import { appendVideoChunk, saveSegmentMeta, type SegmentMeta } from "@/services/storage/videoStore";

const MIME_CANDIDATES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
];

export interface FinishedRecording {
  blob: Blob;
  mimeType: string;
  startedAtMs: number;
  endedAtMs: number;
  segment: number;
}

let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let segmentMeta: SegmentMeta | null = null;
/** IndexedDB write queue - preserves chunk order. */
let persistQueue: Promise<unknown> = Promise.resolve();
const enqueue = (job: () => Promise<unknown>) => {
  persistQueue = persistQueue.then(job).catch((e) => console.warn("[recorder] IndexedDB write failed", e));
};
/** Guards against a double getUserMedia (e.g. StrictMode runs effects twice). */
let pendingPreview: Promise<MediaStream> | null = null;

const pickMime = () => MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? "";

export function isCameraSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

/** Preview only (no recording), e.g. on the start screen. */
export async function openPreview(): Promise<MediaStream> {
  const store = useRecordingStore.getState();
  if (store.stream) return store.stream;
  if (pendingPreview) return pendingPreview;
  store.patch({ status: "requesting", error: null });
  try {
    pendingPreview = navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 }, facingMode: "user" },
      audio: false, // intentionally no sound
    });
    const stream = await pendingPreview;
    store.patch({ stream, status: "idle" });
    return stream;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No camera access";
    store.patch({ status: "error", error: msg });
    throw e;
  } finally {
    pendingPreview = null;
  }
}

export function closePreview(): void {
  const { stream, status, patch } = useRecordingStore.getState();
  if (status === "recording") return; // do not close while recording
  stream?.getTracks().forEach((t) => t.stop());
  patch({ stream: null, status: "idle" });
}

export async function startRecording({ sessionId, segment }: { sessionId: string; segment: number }): Promise<number> {
  const stream = await openPreview();
  const mimeType = pickMime();
  chunks = [];
  recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 1_500_000 } : undefined);
  recorder.ondataavailable = (e) => {
    if (e.data.size === 0) return;
    chunks.push(e.data);
    const data = e.data;
    const ts = Date.now();
    enqueue(() => appendVideoChunk(sessionId, segment, data, ts));
  };

  return new Promise<number>((resolve) => {
    recorder!.onstart = () => {
      const startedAtMs = Date.now();
      segmentMeta = { sessionId, segment, mimeType: recorder?.mimeType || mimeType || "video/webm", startedAtMs, endedAtMs: null };
      const meta = { ...segmentMeta };
      enqueue(() => saveSegmentMeta(meta));
      useRecordingStore.getState().patch({ status: "recording", startedAtMs });
      resolve(startedAtMs);
    };
    recorder!.start(1_000); // chunks every 1 s -> into IndexedDB
  });
}

export function stopRecording(): Promise<FinishedRecording | null> {
  const store = useRecordingStore.getState();
  if (!recorder || recorder.state === "inactive" || !store.startedAtMs) {
    closePreview();
    return Promise.resolve(null);
  }
  const startedAtMs = store.startedAtMs;
  store.patch({ status: "stopping" });

  return new Promise((resolve) => {
    recorder!.onstop = () => {
      const endedAtMs = Date.now();
      const mimeType = recorder?.mimeType || "video/webm";
      const blob = new Blob(chunks, { type: mimeType });
      const segment = segmentMeta?.segment ?? 0;
      if (segmentMeta) {
        const meta = { ...segmentMeta, endedAtMs };
        enqueue(() => saveSegmentMeta(meta));
      }
      recorder = null;
      chunks = [];
      segmentMeta = null;
      useRecordingStore.getState().stream?.getTracks().forEach((t) => t.stop());
      useRecordingStore.getState().patch({ status: "idle", stream: null, startedAtMs: null });
      // Wait until the last chunk reaches IndexedDB - export reads from the database
      void persistQueue.then(() => resolve({ blob, mimeType, startedAtMs, endedAtMs, segment }));
    };
    recorder!.stop();
  });
}
