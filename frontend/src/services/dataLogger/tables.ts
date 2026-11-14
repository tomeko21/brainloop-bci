/**
 * In-memory data tables of the current session + their CSV column order.
 * Adding a column: extend the row type in types/domain/tables.ts AND the column list here.
 */
import type { FaceRow, MlWindowRow, ReelViewRow, ScrollRow } from "@/types/domain";
import { DataTable } from "./DataTable";

export const REEL_VIEW_COLUMNS = [
  "session_id", "reel_id", "reel_index", "mood", "view_start_ms", "view_end_ms", "t_rel_start_ms", "t_rel_end_ms",
  "dwell_ms", "played_ms", "duration_ms", "watch_pct", "completed_loops", "pause_count", "liked",
  "exit_direction", "exit_scroll_speed_reels_s",
] as const satisfies readonly (keyof ReelViewRow)[];

export const SCROLL_COLUMNS = [
  "session_id", "ts_ms", "t_rel_ms", "scroll_top_px", "velocity_px_s", "velocity_reels_s", "direction", "active_index",
] as const satisfies readonly (keyof ScrollRow)[];

export const FACE_COLUMNS = [
  "session_id", "ts_ms", "t_rel_ms", "face_present", "inference_ms",
  "ear_left", "ear_right", "ear_avg", "blink_bs_left", "blink_bs_right", "eyes_closed",
  "blink_count", "blink_rate_per_min", "perclos_60s", "gaze_x", "gaze_y", "eye_squint",
  "jaw_open", "brow_down", "head_pitch_deg", "head_yaw_deg", "head_roll_deg", "face_scale",
  "forehead_r", "forehead_g", "forehead_b",
  "nose_x", "nose_y", "nose_z", "chin_x", "chin_y", "forehead_x", "forehead_y",
  "r_eye_outer_x", "r_eye_outer_y", "r_eye_inner_x", "r_eye_inner_y",
  "l_eye_outer_x", "l_eye_outer_y", "l_eye_inner_x", "l_eye_inner_y",
  "r_iris_x", "r_iris_y", "l_iris_x", "l_iris_y",
  "mouth_left_x", "mouth_left_y", "mouth_right_x", "mouth_right_y",
  "lip_top_x", "lip_top_y", "lip_bottom_x", "lip_bottom_y",
] as const satisfies readonly (keyof FaceRow)[];

export const ML_WINDOW_COLUMNS = [
  "session_id", "ts_ms", "t_rel_ms", "window_start_ms", "window_end_ms",
  "face_present_ratio", "ear_mean", "blink_rate_per_min", "perclos", "head_pitch_mean", "head_motion", "jaw_open_max",
  "scroll_speed_mean", "scroll_samples", "dwell_mean_sec", "watch_pct_mean", "likes_in_window",
  "bri_ai", "bri_eeg", "should_stop", "model_version",
] as const satisfies readonly (keyof MlWindowRow)[];

/** Tables of the current session (cleared when a new one starts). */
export const reelViewsTable = new DataTable<ReelViewRow>("reel_views", REEL_VIEW_COLUMNS);
export const scrollTable = new DataTable<ScrollRow>("scroll", SCROLL_COLUMNS);
export const faceTable = new DataTable<FaceRow>("face", FACE_COLUMNS);
export const mlWindowsTable = new DataTable<MlWindowRow>("ml_windows", ML_WINDOW_COLUMNS);

export const ALL_TABLES = [reelViewsTable, scrollTable, faceTable, mlWindowsTable] as const;

export function clearSessionTables() {
  ALL_TABLES.forEach((t) => t.clear());
}
