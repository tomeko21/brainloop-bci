/**
 * 8 electrodes of the BrainAccess headset (10–20 system) – order and names as in the BrainAccess app.
 * Odd = left hemisphere, even = right.
 */
export const ELECTRODES = ["F4", "F3", "C4", "C3", "P4", "P3", "O2", "O1"] as const;
export type Electrode = (typeof ELECTRODES)[number];

/**
 * Electrode contact quality:
 *  good  – sensible EEG signal (PTP in the physiological range),
 *  poor  – saturated signal / artifact (PTP in the tens of thousands of µV = no skin contact),
 *  none  – flat line (PTP = 0, the channel is not transmitting).
 */
export type ContactQuality = "good" | "poor" | "none";

export interface BandPower {
  theta: number;
  alpha: number;
  beta: number;
}

/** Headset accelerometer (in g) – head movements / nodding when fatigued. */
export interface AccelSample {
  x: number;
  y: number;
  z: number;
}

/** One EEG stream message (the backend yields it e.g. 4–10×/s). */
export interface BrainSnapshot {
  tMs: number;
  /** Normalized activity 0..1 for each electrode (for brain highlighting). */
  channels: Record<Electrode, number>;
  /** Peak-to-peak in µV from the last window (like "PTP" in the BrainAccess app). */
  ptpUv: Record<Electrode, number>;
  /** Optional from the backend; if absent, the frontend computes it from ptpUv (lib/eeg.ts). */
  quality?: Record<Electrode, ContactQuality>;
  bands: BandPower;
  /** (theta + alpha) / beta normalized to 0..1 */
  fatigueScore: number;
  shouldStop: boolean;
  /** BRI (BrainRot Index) 0..100 computed by the backend from the electrodes. */
  bri?: number;
  accel?: AccelSample;
}
