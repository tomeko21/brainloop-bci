/**
 * Measurement sessions API.
 * ⚠️ MOCK: sessions are "saved" in localStorage, while the recording and CSV
 *          go to the data/ folder via the Vite server plugin (./mocks/localDataSink.ts).
 *          Eventually FastAPI will do the same (writing to data/ on the backend side).
 */
import type { EndSessionInput, StartSessionInput, UploadDatasetInput, UploadRecordingInput } from "@/types/api/input/useSession";
import type {
  EndSessionOutput, StartSessionOutput, StorageStatusOutput, UploadDatasetOutput, UploadRecordingOutput,
} from "@/types/api/output/useSession";
import type { SessionInfo } from "@/types/domain";
import { recordingFileName } from "@/lib/files";
import { API_BASE_URL, USE_MOCKS, http, mockDelay } from "./client";
import { readDb, writeDb } from "./mocks/mockDb";
import { appendDatasetLocal, localStatus, saveFileLocal } from "./mocks/localDataSink";

export async function startSession(input: StartSessionInput): Promise<StartSessionOutput> {
  if (!USE_MOCKS) return http<StartSessionOutput>("/api/sessions", { method: "POST", body: input });

  // --- MOCK ---
  await mockDelay(400, 700);
  const now = Date.now();
  const session: SessionInfo = {
    id: `ses_${now.toString(36)}`,
    subjectName: input.subjectName,
    startedAtMs: now,
    endedAtMs: null,
    cameraEnabled: input.cameraEnabled,
  };
  writeDb((db) => ({ ...db, sessions: { ...db.sessions, [session.id]: session } }));
  return { session, serverUtcMs: now };
}

export async function endSession(input: EndSessionInput): Promise<EndSessionOutput> {
  if (!USE_MOCKS) return http<EndSessionOutput>(`/api/sessions/${input.sessionId}/stop`, { method: "POST", body: input });

  // --- MOCK ---
  await mockDelay(200, 400);
  const existing = readDb().sessions[input.sessionId];
  const session: SessionInfo = existing
    ? { ...existing, endedAtMs: input.endedAtMs }
    : { id: input.sessionId, subjectName: "?", startedAtMs: input.endedAtMs, endedAtMs: input.endedAtMs, cameraEnabled: false };
  writeDb((db) => ({
    ...db,
    sessions: { ...db.sessions, [session.id]: session },
    activeReel: db.activeReel?.sessionId === session.id ? null : db.activeReel,
  }));
  return { session };
}

export async function uploadRecording(input: UploadRecordingInput): Promise<UploadRecordingOutput> {
  const fileName = recordingFileName(input.sessionId, input.startedAtMs, input.endedAtMs);

  if (!USE_MOCKS) {
    const form = new FormData();
    form.append("video", input.blob, fileName);
    form.append("started_at_ms", String(input.startedAtMs));
    form.append("ended_at_ms", String(input.endedAtMs));
    return http<UploadRecordingOutput>(`/api/sessions/${input.sessionId}/recording`, { method: "POST", body: form });
  }

  // --- MOCK --- file saved to data/sessions/<folder>/ via the Vite server
  const savedTo = await saveFileLocal(`sessions/${input.folder}`, fileName, input.blob);
  return {
    recording: {
      sessionId: input.sessionId,
      fileName,
      mimeType: input.blob.type,
      sizeBytes: input.blob.size,
      startedAtMs: input.startedAtMs,
      endedAtMs: input.endedAtMs,
    },
    savedTo,
  };
}

export async function uploadDataset(input: UploadDatasetInput): Promise<UploadDatasetOutput> {
  if (!USE_MOCKS) return http<UploadDatasetOutput>(`/api/sessions/${input.sessionId}/dataset`, { method: "POST", body: input });

  // --- MOCK --- 1) session files to data/sessions/<folder>/  2) append to data/dataset/*.csv
  const accepted: Record<string, number> = {};
  const dataset: Record<string, number | "skipped"> = {};
  let savedTo: string | null = null;
  for (const f of input.files) {
    accepted[f.name] = Math.max(0, f.csv.trim().split("\n").length - 1);
    const path = await saveFileLocal(`sessions/${input.folder}`, f.name, f.csv);
    if (path) savedTo = path.slice(0, path.lastIndexOf("/"));
  }
  if (savedTo) {
    for (const f of input.files) {
      const r = await appendDatasetLocal(f.name.replace(/\.csv$/, ""), input.sessionId, f.csv);
      if (r !== null) dataset[f.name] = r;
    }
  }
  return { accepted, savedTo, dataset };
}

export async function fetchStorageStatus(): Promise<StorageStatusOutput> {
  if (!USE_MOCKS) return { mode: "backend", location: API_BASE_URL };
  const local = await localStatus(); // --- MOCK ---
  return local ? { mode: "local", location: local.dataDir } : { mode: "none", location: null };
}
