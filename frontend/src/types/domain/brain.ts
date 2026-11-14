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
  /** Enough electrodes with clean signal in this window to trust the metrics. */
  reliable?: boolean;
  /** BRI is relative to the person's resting baseline (30 s fixation cross) – true until it is collected. */
  calibrating?: boolean;
  /** "fixation" = the cross is on screen now; "auto" = first 30 s of clean signal (no cross). */
  calibrationMode?: "auto" | "fixation";
  /** 0..1 progress of that calibration. */
  calibrationProgress?: number;
  /** Good electrodes left out of this window because of a blink / spike (not used for BRI). */
  artifacts?: Electrode[];
  /** Electrodes pinned at the amplifier rail (no skin contact). All of them = reference/bias electrode problem. */
  saturated?: number;
  /** Where the data comes from – always the BrainAccess headset ("brainaccess"). */
  source?: string;
  /** Normalized activity 0..1 for each electrode (for brain highlighting). */
  channels: Record<Electrode, number>;
  /** Peak-to-peak in µV from the last window (like "PTP" in the BrainAccess app). */
  ptpUv: Record<Electrode, number>;
  /** Optional from the backend; if absent, the frontend computes it from ptpUv (lib/eeg.ts). */
  quality?: Record<Electrode, ContactQuality>;
  bands: BandPower;
  /** Fatigue 0..1 = 3 s median of the raw BRI (reacts faster than the smoothed `bri`), 0 while calibrating. */
  fatigueScore: number;
  /** (theta + alpha) / beta of this window – the raw input of BRI. null = no reliable window. */
  ratio?: number | null;
  /** The same ratio of this person at rest (fixation cross) – BRI 25. null = still calibrating. */
  baselineRatio?: number | null;
  shouldStop: boolean;
  /** BRI (BrainRot Index) 0..100 computed by the backend from the electrodes. */
  bri?: number;
  accel?: AccelSample;
  /** Band-passed raw signal (µV) of the samples since the previous snapshot, per electrode, at `waveHz`. */
  wave?: Partial<Record<Electrode, number[]>>;
  waveHz?: number;
}
