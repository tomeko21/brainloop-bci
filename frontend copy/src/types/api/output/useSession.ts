import type { RecordingMeta, SessionInfo } from "@/types/domain";

export interface StartSessionOutput {
  session: SessionInfo;
  serverUtcMs: number;  // for syncing with EEG
}

export interface EndSessionOutput {
  session: SessionInfo;
}

export interface UploadRecordingOutput {
  recording: RecordingMeta;
  savedTo: string | null;  // path under data/sessions, null if not saved
}

export interface UploadDatasetOutput {
  accepted: Record<string, number>;
  savedTo: string | null;
  dataset: Record<string, number | "skipped">;  // rows appended to data/dataset/*.csv, or skipped if the session is already there
}

export interface StorageStatusOutput {
  mode: "local" | "backend" | "none";  // backend = FastAPI writes to data/, none = ZIP download only
  location: string | null;
}
