// Session lifecycle and uploads. The backend writes everything under data/sessions/<session>/.
import type { EndSessionInput, StartSessionInput, UploadDatasetInput, UploadRecordingInput } from "@/types/api/input/useSession";
import type {
  EndSessionOutput, StartSessionOutput, StorageStatusOutput, UploadDatasetOutput, UploadRecordingOutput,
} from "@/types/api/output/useSession";
import { http } from "./client";

export function startSession(input: StartSessionInput): Promise<StartSessionOutput> {
  return http<StartSessionOutput>("/api/sessions", { method: "POST", body: input });
}

export function endSession(input: EndSessionInput): Promise<EndSessionOutput> {
  return http<EndSessionOutput>(`/api/sessions/${input.sessionId}/stop`, {
    method: "POST",
    body: { endedAtMs: input.endedAtMs },
  });
}

export function uploadRecording(input: UploadRecordingInput): Promise<UploadRecordingOutput> {
  const form = new FormData();
  form.append("video", input.blob, "recording.webm");
  form.append("started_at_ms", String(input.startedAtMs));
  form.append("ended_at_ms", String(input.endedAtMs));
  return http<UploadRecordingOutput>(`/api/sessions/${input.sessionId}/recording`, { method: "POST", body: form });
}

export function uploadDataset(input: UploadDatasetInput): Promise<UploadDatasetOutput> {
  return http<UploadDatasetOutput>(`/api/sessions/${input.sessionId}/dataset`, {
    method: "POST",
    body: { files: input.files },
  });
}

export function fetchStorageStatus(): Promise<StorageStatusOutput> {
  return http<StorageStatusOutput>("/api/storage/status");
}
