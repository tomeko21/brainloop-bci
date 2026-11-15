// Camera recorder singleton (video only). Lives outside React so recording survives navigation, and every
// 1 s chunk goes straight to IndexedDB (storage/videoStore) so a reload doesn't lose the recording.
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
let persistQueue: Promise<unknown> = Promise.resolve();  // keeps IndexedDB writes in chunk order
const enqueue = (job: () => Promise<unknown>) => {
  persistQueue = persistQueue.then(job).catch((e) => console.warn("[recorder] IndexedDB write failed", e));
};
let pendingPreview: Promise<MediaStream> | null = null;  // StrictMode runs effects twice, avoid a double getUserMedia

const pickMime = () => MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? "";

export function isCameraSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

export async function openPreview(): Promise<MediaStream> {
  const store = useRecordingStore.getState();
  if (store.stream) return store.stream;
  if (pendingPreview) return pendingPreview;
  store.patch({ status: "requesting", error: null });
  try {
    pendingPreview = navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 }, facingMode: "user" },
      audio: false,
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
  if (status === "recording") return;  // never close while recording
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
    recorder!.start(1_000);  // 1 s chunks
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
      // wait for the last chunk to land in IndexedDB, export reads from there
      void persistQueue.then(() => resolve({ blob, mimeType, startedAtMs, endedAtMs, segment }));
    };
    recorder!.stop();
  });
}
