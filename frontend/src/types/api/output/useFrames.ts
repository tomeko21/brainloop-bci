/** Features the backend computed from a batch of frames (backend/app/ml/video_features.py). */
export interface VideoFeatures {
  frames: number;
  facePresentRatio: number;
  /** 0..255 */
  brightness: number;
  /** Mean absolute difference between consecutive frames (0..255). */
  motion: number;
  /** Face box area / frame area – proxy for distance to the screen. */
  faceArea: number | null;
  /** Mean forehead RGB (input for heart rate / rPPG). */
  foreheadRgb: [number, number, number] | null;
  windowStartMs: number;
  windowEndMs: number;
}

export interface UploadFramesOutput {
  accepted: number;
  features: VideoFeatures;
}
