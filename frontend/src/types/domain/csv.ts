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
  | "baseline_start"
  | "baseline_end"
  | "baseline_abort"
  | "calm_filter"
  | "scroll_reminder"
  | "settings_change";

export interface CsvRow {
  sessionId: string;
  subjectName: string;
  event: CsvEventType;
  reelId: string;
  tsMs: number;  // epoch ms
  tRelMs: number;  // ms since recording start, or session start with the camera off
  value: string;
}
