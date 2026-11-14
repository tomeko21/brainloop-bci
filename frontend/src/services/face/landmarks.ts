/**
 * MediaPipe Face Mesh landmark indices (478 points). "left/right" = the PERSON's side (not the image's).
 * We take only individual useful points, not the whole mesh.
 */
export const LM = {
  noseTip: 1,
  chin: 152,
  forehead: 10,
  foreheadMid: 151,
  rightEyeOuter: 33,
  rightEyeInner: 133,
  leftEyeOuter: 263,
  leftEyeInner: 362,
  rightEyeTop: 159,
  rightEyeBottom: 145,
  leftEyeTop: 386,
  leftEyeBottom: 374,
  rightIris: 468,
  leftIris: 473,
  mouthLeft: 291,
  mouthRight: 61,
  lipTop: 13,
  lipBottom: 14,
} as const;

/** 6 eye points for Eye Aspect Ratio: [p1 corner, p2, p3 top, p4 corner, p5, p6 bottom] */
export const RIGHT_EYE_EAR = [33, 160, 158, 133, 153, 144] as const;
export const LEFT_EYE_EAR = [362, 385, 387, 263, 373, 380] as const;
