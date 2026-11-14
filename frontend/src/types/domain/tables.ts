/**
 * Rows of the tables collected for model training.
 * Every table has `session_id`, `ts_ms` (epoch) and `t_rel_ms` (ms since the recording start),
 * so it is easy to join with the video: video second = t_rel_ms / 1000.
 */
export interface Stamp {
  session_id: string;
  ts_ms: number;
  t_rel_ms: number;
}

/** session.csv – one row per session: recording start and end in one place. */
export interface SessionRow {
  session_id: string;
  subject_name: string;
  camera_enabled: 0 | 1;
  session_start_ms: number;
  session_end_ms: number;
  recording_start_ms: number | "";
  recording_end_ms: number | "";
  recording_duration_ms: number | "";
  /** How many recording segments (>1 when recording was resumed, e.g. after a page refresh). */
  recording_segments: number;
  /** Segment video files separated by "|". Details in recordings.csv. */
  recording_file: string;
  video_mime: string;
  face_sample_hz: number;
  face_rows: number;
  user_agent: string;
  screen_w: number;
  screen_h: number;
}

/** recordings.csv – one row per recording segment (.webm file). */
export interface RecordingSegmentRow {
  session_id: string;
  segment: number;
  recording_start_ms: number;
  recording_end_ms: number;
  duration_ms: number;
  /** How many ms after the start of segment 0 this segment begins. Second in the file = (t_rel_ms - offset) / 1000. */
  offset_from_origin_ms: number;
  /** 1 = segment interrupted (page refresh / close), end = last saved chunk */
  interrupted: 0 | 1;
  file: string;
  mime: string;
  size_bytes: number;
}

/** reel_views.csv – one view of a reel. */
export interface ReelViewRow {
  session_id: string;
  reel_id: string;
  reel_index: number;
  mood: string;
  view_start_ms: number;
  view_end_ms: number;
  t_rel_start_ms: number;
  t_rel_end_ms: number;
  /** Time on the reel (wall clock). */
  dwell_ms: number;
  /** Actual playback time (excluding pauses and background tab). */
  played_ms: number;
  duration_ms: number;
  /** played_ms / duration_ms * 100 – can be > 100 when looping. */
  watch_pct: number;
  completed_loops: number;
  pause_count: number;
  liked: 0 | 1;
  /** "next" | "prev" | "end" (end of session / leaving the feed) */
  exit_direction: string;
  /** Peak scroll speed when leaving the reel (reels/s). */
  exit_scroll_speed_reels_s: number;
}

/** scroll.csv – scroll speed samples (only during movement). */
export interface ScrollRow extends Stamp {
  scroll_top_px: number;
  velocity_px_s: number;
  velocity_reels_s: number;
  direction: -1 | 0 | 1;
  active_index: number;
}

/** face.csv – features from MediaPipe Face Landmarker (~10 Hz). */
export interface FaceRow extends Stamp {
  face_present: 0 | 1;
  inference_ms: number;
  // --- eyes ---
  ear_left: number;
  ear_right: number;
  ear_avg: number;
  blink_bs_left: number;
  blink_bs_right: number;
  eyes_closed: 0 | 1;
  blink_count: number;
  blink_rate_per_min: number;
  perclos_60s: number;
  gaze_x: number;
  gaze_y: number;
  eye_squint: number;
  // --- mouth / expression ---
  jaw_open: number;
  brow_down: number;
  // --- head ---
  head_pitch_deg: number;
  head_yaw_deg: number;
  head_roll_deg: number;
  /** Distance between eye corners (normalized) – proxy for distance from the screen. */
  face_scale: number;
  // --- rPPG: mean forehead color ---
  forehead_r: number;
  forehead_g: number;
  forehead_b: number;
  // --- selected landmarks (x, y normalized 0..1) ---
  nose_x: number; nose_y: number; nose_z: number;
  chin_x: number; chin_y: number;
  forehead_x: number; forehead_y: number;
  r_eye_outer_x: number; r_eye_outer_y: number;
  r_eye_inner_x: number; r_eye_inner_y: number;
  l_eye_outer_x: number; l_eye_outer_y: number;
  l_eye_inner_x: number; l_eye_inner_y: number;
  r_iris_x: number; r_iris_y: number;
  l_iris_x: number; l_iris_y: number;
  mouth_left_x: number; mouth_left_y: number;
  mouth_right_x: number; mouth_right_y: number;
  lip_top_x: number; lip_top_y: number;
  lip_bottom_x: number; lip_bottom_y: number;
}

/** Live face feature summary (UI + heartbeat to the admin). */
export interface FaceLiveSummary {
  present: boolean;
  earAvg: number;
  blinkRatePerMin: number;
  perclos: number;
  pitchDeg: number;
  yawDeg: number;
  rollDeg: number;
  jawOpen: number;
  fps: number;
  inferenceMs: number;
}

/** ml_windows.csv – feature window sent to the model + its response (every 2 s). */
export interface MlWindowRow extends Stamp {
  window_start_ms: number;
  window_end_ms: number;
  face_present_ratio: number;
  ear_mean: number;
  blink_rate_per_min: number;
  perclos: number;
  head_pitch_mean: number;
  head_motion: number;
  jaw_open_max: number;
  scroll_speed_mean: number;
  scroll_samples: number;
  dwell_mean_sec: number;
  watch_pct_mean: number;
  likes_in_window: number;
  /** Camera model BRI (empty until the model is trained). */
  bri_ai: number;
  /** EEG headset BRI at the same moment – the training label (empty without a headset). */
  bri_eeg: number;
  should_stop: 0 | 1;
  model_version: string;
}
