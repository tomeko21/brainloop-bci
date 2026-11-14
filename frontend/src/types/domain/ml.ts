/**
 * Feature window (last ~10 s) computed on the user's device from the camera (MediaPipe) and scroll.
 * This is the input of the "no headset" model – the same vector goes to training and prediction.
 * NaN = no data (e.g. camera off).
 */
export interface MlFeatureWindow {
  sessionId: string;
  windowStartMs: number;
  windowEndMs: number;
  // --- face ---
  facePresentRatio: number;
  earMean: number;
  blinkRatePerMin: number;
  perclos: number;
  headPitchMean: number;
  /** Variability of nose position – small = "freezing" in front of the screen. */
  headMotion: number;
  jawOpenMax: number;
  // --- scroll / behavior ---
  scrollSpeedMean: number;
  scrollSamples: number;
  /** Mean time on a reel over recent views (s). */
  dwellMeanSec: number;
  watchPctMean: number;
  likesInWindow: number;
}

export interface MlFactor {
  feature: string;
  /** Contribution to the result in BRI points (+ increases brainrot). */
  contribution: number;
}

export interface MlPrediction {
  /** BRI (BrainRot Index) 0..100 from the model. */
  bri: number;
  shouldStop: boolean;
  modelVersion: string;
  /** Top factors (to explain "why" to the jury). */
  topFactors: MlFactor[];
  predictedAtMs: number;
}
