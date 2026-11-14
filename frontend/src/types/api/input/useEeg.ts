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

/** GET /api/eeg/status – no parameters. */
export type EegStatusInput = void;

/** POST /api/eeg/select – which Board stream to use (when several headsets are connected in Board). */
export interface EegSelectInput {
  streamName: string;
}

/** POST /api/eeg/connect – direct mode: exact advertised name, e.g. "BA MINI 074". */
export interface EegConnectInput {
  deviceName: string;
}

/** POST /api/eeg/baseline/start | finish – no body; "start" when the fixation cross appears, "finish" after 30 s. */
export type EegBaselineInput = "start" | "finish";
