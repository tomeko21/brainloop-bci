/** GET /api/live/viewer – which reel is currently being watched on another device. */
export interface LiveViewerInput {
  /** Optional: watch a specific session. None = the latest active one. */
  sessionId?: string;
}
