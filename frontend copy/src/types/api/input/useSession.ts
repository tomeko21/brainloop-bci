// POST /api/sessions
export interface StartSessionInput {
  subjectName: string;
  cameraEnabled: boolean;
}

// POST /api/sessions/{id}/stop
export interface EndSessionInput {
  sessionId: string;
  endedAtMs: number;
}

// POST /api/sessions/{id}/recording, multipart
export interface UploadRecordingInput {
  sessionId: string;
  blob: Blob;
  startedAtMs: number;
  endedAtMs: number;
}

// POST /api/sessions/{id}/dataset
export interface UploadDatasetInput {
  sessionId: string;
  files: { name: string; csv: string }[];
}

export type StorageStatusInput = void;
