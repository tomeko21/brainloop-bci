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
  startedAtMs: number;  // first recorded frame, epoch ms
  endedAtMs: number;
}
