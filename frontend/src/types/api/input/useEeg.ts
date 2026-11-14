/**
 * EEG stream from the backend (FastAPI yields successive electrode readings).
 *  SSE: GET /api/eeg/stream?session_id=...      (StreamingResponse, media_type="text/event-stream")
 *  WS : /ws/eeg/live?session_id=...
 */
export interface EegStreamInput {
  sessionId?: string;
  /** Disable listening (e.g. when the panel is hidden). */
  enabled?: boolean;
}
