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
  /** BRI 0..100 from the CAMERA model – null until the model is trained (backend/app/ml/predictor.py). */
  bri: number | null;
  /** BRI 0..100 from the EEG headset at the same moment – null without a streaming headset. */
  briEeg: number | null;
  /** Best available BRI (camera, else EEG) crossed the break threshold. */
  shouldStop: boolean;
  modelVersion: string;
  /** Top factors (to explain "why" to the jury). */
  topFactors: MlFactor[];
  predictedAtMs: number;
}

/** Best available BRI: the camera model when trained, otherwise the EEG headset. */
export const bestBri = (p: MlPrediction | null | undefined): number | null => p?.bri ?? p?.briEeg ?? null;
