// Feature window (~10 s) built on the device from camera + scroll, input of the predict-window model. NaN = no data.
export interface MlFeatureWindow {
  sessionId: string;
  windowStartMs: number;
  windowEndMs: number;
  facePresentRatio: number;
  earMean: number;
  blinkRatePerMin: number;
  perclos: number;
  headPitchMean: number;
  headMotion: number;  // nose position variability, low = freezing in front of the screen
  jawOpenMax: number;
  scrollSpeedMean: number;
  scrollSamples: number;
  dwellMeanSec: number;  // s
  watchPctMean: number;
  likesInWindow: number;
}

export interface MlFactor {
  feature: string;
  contribution: number;  // BRI points, positive pushes toward brainrot
}

export interface MlPrediction {
  bri: number | null;  // camera model, null until one is trained (backend app/ml/predictor.py)
  briEeg: number | null;  // headset BRI at the same moment
  shouldStop: boolean;
  modelVersion: string;
  topFactors: MlFactor[];
  predictedAtMs: number;
}

// camera model when it has a value, otherwise EEG
export const bestBri = (p: MlPrediction | null | undefined): number | null => p?.bri ?? p?.briEeg ?? null;
