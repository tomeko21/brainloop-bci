// Rows of the CSV tables collected for training. t_rel_ms is ms since the first recording segment started,
// so for segment 0 the video second is t_rel_ms / 1000.
export interface Stamp {
  session_id: string;
  ts_ms: number;
  t_rel_ms: number;
}

export interface SessionRow {
  session_id: string;
  subject_name: string;
  camera_enabled: 0 | 1;
  session_start_ms: number;
  session_end_ms: number;
  recording_start_ms: number | "";
  recording_end_ms: number | "";
  recording_duration_ms: number | "";
  recording_segments: number;
  recording_file: string;  // segment files joined with |
  video_mime: string;
  face_sample_hz: number;
  face_rows: number;
  user_agent: string;
  screen_w: number;
  screen_h: number;
}

export interface RecordingSegmentRow {
  session_id: string;
  segment: number;
  recording_start_ms: number;
  recording_end_ms: number;
  duration_ms: number;
  offset_from_origin_ms: number;  // second in the file = (t_rel_ms - offset) / 1000
  interrupted: 0 | 1;  // cut off by a refresh, end = last saved chunk
  file: string;
  mime: string;
  size_bytes: number;
}

export interface ReelViewRow {
  session_id: string;
  reel_id: string;
  reel_index: number;
  mood: string;
  view_start_ms: number;
  view_end_ms: number;
  t_rel_start_ms: number;
  t_rel_end_ms: number;
  dwell_ms: number;  // wall clock on the reel
  played_ms: number;  // real playback, no pauses or background time
  duration_ms: number;
  watch_pct: number;  // can exceed 100 when looping
  completed_loops: number;
  pause_count: number;
  liked: 0 | 1;
  exit_direction: string;  // next | prev | end
  exit_scroll_speed_reels_s: number;
}

export interface ScrollRow extends Stamp {
  scroll_top_px: number;
  velocity_px_s: number;
  velocity_reels_s: number;
  direction: -1 | 0 | 1;
  active_index: number;
}

export interface FaceRow extends Stamp {
  face_present: 0 | 1;
  inference_ms: number;
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
  jaw_open: number;
  brow_down: number;
  head_pitch_deg: number;
  head_yaw_deg: number;
  head_roll_deg: number;
  face_scale: number;  // eye corner distance, proxy for distance to the screen
  forehead_r: number;  // mean forehead RGB, for rPPG
  forehead_g: number;
  forehead_b: number;
  // landmarks normalized 0..1
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
  bri_ai: number;  // predict-window model, empty when it returns nothing
  bri_eeg: number;  // headset BRI at the same moment, the training label
  should_stop: 0 | 1;
  model_version: string;
}
