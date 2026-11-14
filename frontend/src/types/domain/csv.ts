export type CsvEventType =
  | "session_start"
  | "session_end"
  | "recording_start"
  | "recording_end"
  | "face_tracker_start"
  | "face_tracker_error"
  | "reel_view_start"
  | "reel_view_end"
  | "reel_loop"
  | "reel_pause"
  | "reel_resume"
  | "reel_like"
  | "reel_unlike"
  | "feed_refresh"
  | "settings_change";

/** One row of events.csv (discrete events). */
export interface CsvRow {
  sessionId: string;
  subjectName: string;
  event: CsvEventType;
  reelId: string;
  /** Epoch ms (UTC). */
  tsMs: number;
  /** ms since the camera recording start (or the session start when the camera is off). */
  tRelMs: number;
  value: string;
}
