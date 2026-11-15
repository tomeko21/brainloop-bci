// GET /api/live/viewer
export interface LiveViewerInput {
  sessionId?: string;  // omitted = latest active session
}

// GET /api/live/events
export interface LiveEventsInput {
  sessionId?: string;
  limit?: number;
}
