// BrainAccess 8-channel layout, order as in the BrainAccess app. Odd = left hemisphere, even = right.
export const ELECTRODES = ["F4", "F3", "C4", "C3", "P4", "P3", "O2", "O1"] as const;
export type Electrode = (typeof ELECTRODES)[number];

// good = PTP in the physiological range, poor = saturated or no skin contact, none = flat line
export type ContactQuality = "good" | "poor" | "none";

export interface BandPower {
  theta: number;
  alpha: number;
  beta: number;
}

// in g
export interface AccelSample {
  x: number;
  y: number;
  z: number;
}

// one EEG stream message, a few per second
export interface BrainSnapshot {
  tMs: number;
  reliable?: boolean;
  calibrating?: boolean;  // true until the resting baseline exists
  calibrationMode?: "auto" | "fixation";  // fixation = cross on screen, auto = first 30 s of clean signal
  calibrationProgress?: number;
  artifacts?: Electrode[];  // good electrodes dropped from this window (blink, spike)
  saturated?: number;  // electrodes at the amplifier rail, all of them = reference electrode problem
  source?: string;
  channels: Record<Electrode, number>;  // normalized 0..1 for the brain map
  ptpUv: Record<Electrode, number>;  // peak-to-peak µV
  quality?: Record<Electrode, ContactQuality>;  // optional, otherwise computed from ptpUv (lib/eeg.ts)
  bands: BandPower;
  fatigueScore: number;  // 0..1, 3 s median of the raw BRI
  ratio?: number | null;  // (theta + alpha) / beta of this window
  baselineRatio?: number | null;  // same ratio at rest, maps to BRI 25
  shouldStop: boolean;
  bri?: number;  // 0..100
  accel?: AccelSample;
  wave?: Partial<Record<Electrode, number[]>>;  // band-passed µV samples since the previous snapshot, at waveHz
  waveHz?: number;
}
