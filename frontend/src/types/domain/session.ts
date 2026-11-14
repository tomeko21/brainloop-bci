export interface SessionInfo {
  id: string;
  subjectName: string;
  startedAtMs: number;
  endedAtMs: number | null;
  cameraEnabled: boolean;
}

export interface RecordingMeta {
  sessionId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Timestamp (epoch ms) of the first recorded frame. */
  startedAtMs: number;
  /** Timestamp (epoch ms) of the recording stop. */
  endedAtMs: number;
}
