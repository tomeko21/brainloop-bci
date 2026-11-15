// Live state from /ws/brainrot, one index from EEG + camera.
export interface BrainrotState {
  tMs: number;
  enabled: boolean;
  error?: string | null;
  bri: number | null;  // smoothed 0..100, 25 = at rest, 70+ = brain rot, null during the cross
  briRaw?: number | null;  // last 2 s window, unsmoothed
  pBrainrot?: number | null;
  stale?: boolean;  // no fresh data, last value is held
  baselineMode?: "default" | "collecting" | "personal";  // default = training population, collecting = cross on screen, personal = own baseline
  baselineElapsedS?: number | null;
  baselineWindows?: number;
  sources?: { eeg: boolean; face: boolean; eegConnected: boolean; faceConnected: boolean };
  eegGoodChannels?: number;
  model?: string;
}

// one camera frame for the backend, features are computed there with the training code
export interface FaceFrameOut {
  ts: number;
  present: boolean;
  lm?: Record<number, [number, number]>;  // landmark index to normalized [x, y]
  bs?: Record<string, number>;  // blendshapes
  m?: number[];  // 4x4 facial transformation matrix
  w?: number;  // video size in px
  h?: number;
}
