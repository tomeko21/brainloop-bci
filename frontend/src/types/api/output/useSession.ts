import type { RecordingMeta, SessionInfo } from "@/types/domain";

export interface StartSessionOutput {
  session: SessionInfo;
  /** Server clock for synchronization with EEG. */
  serverUtcMs: number;
}

export interface EndSessionOutput {
  session: SessionInfo;
}

export interface UploadRecordingOutput {
  recording: RecordingMeta;
  /** Path of the saved file (e.g. data/sessions/.../recording_….webm) or null if not saved. */
  savedTo: string | null;
}

export interface UploadDatasetOutput {
  /** Number of accepted rows per file. */
  accepted: Record<string, number>;
  /** Session folder (data/sessions/...) or null if local saving is unavailable. */
  savedTo: string | null;
  /** Append to the combined dataset (data/dataset/*.csv): rows, or "skipped" if the session was already there. */
  dataset: Record<string, number | "skipped">;
}

export interface StorageStatusOutput {
  /** "local" = Vite plugin writes to data/, "backend" = FastAPI, "none" = ZIP download only. */
  mode: "local" | "backend" | "none";
  location: string | null;
}
