// computed by backend app/ml/video_features.py
export interface VideoFeatures {
  frames: number;
  facePresentRatio: number;
  brightness: number;  // 0..255
  motion: number;  // mean abs difference between frames, 0..255
  faceArea: number | null;  // face box / frame area, proxy for distance
  foreheadRgb: [number, number, number] | null;  // for rPPG
  windowStartMs: number;
  windowEndMs: number;
}

export interface UploadFramesOutput {
  accepted: number;
  features: VideoFeatures;
}
