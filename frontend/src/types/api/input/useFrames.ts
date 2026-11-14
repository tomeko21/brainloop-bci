/** POST /api/sessions/{id}/frames – a batch of JPEG camera frames. */
export interface UploadFramesInput {
  sessionId: string;
  frames: { blob: Blob; tsMs: number }[];
}
