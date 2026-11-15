// POST /api/sessions/{id}/frames
export interface UploadFramesInput {
  sessionId: string;
  frames: { blob: Blob; tsMs: number }[];
}
