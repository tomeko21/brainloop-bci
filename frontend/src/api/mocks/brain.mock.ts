/**
 * ============================================================
 *  MOCK EEG SIGNAL – to be replaced by a stream from FastAPI
 * ============================================================
 * Imitates a BrainAccess headset: 8 channels (F3/F4, C3/C4, P3/P4, O1/O2) + accelerometer.
 *  - activity 0..1 (brain highlighting) with slowly rising "fatigue",
 *  - PTP in µV like in the BrainAccess app, including channels with no contact
 *    (saturated ~50 000 µV) and flat ones (0 µV) – so the quality states are visible,
 *  - the contact scenario changes every ~40 s (as if someone were adjusting the gel).
 */
import { ELECTRODES, type BrainSnapshot, type ContactQuality, type Electrode } from "@/types/domain";

const PHASES: Record<Electrode, number> = {
  F4: 0.0, F3: 0.7, C4: 1.4, C3: 2.1, P4: 2.8, P3: 3.5, O2: 4.2, O1: 4.9,
};

/** Successive "headset setups": which channels have contact problems. */
const CONTACT_SCENARIOS: Partial<Record<Electrode, ContactQuality>>[] = [
  { F4: "none", O2: "none", O1: "none", C3: "poor", P3: "poor" }, // as in the BrainAccess screenshot
  { O2: "poor", F4: "poor" },
  {}, // everything fine
  { O1: "none" },
];

let smoothed: Record<Electrode, number> | null = null;
let briSmoothed: number | null = null;
/** Alert hysteresis – so it does not flicker for values near the threshold. */
let stopLatched = false;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const map = <T,>(fn: (e: Electrode) => T) => Object.fromEntries(ELECTRODES.map((e) => [e, fn(e)])) as Record<Electrode, T>;

export function mockBrainSnapshot(nowMs = Date.now()): BrainSnapshot {
  const t = nowMs / 1000;
  // Slow "fatigue" cycle ~ 90 s
  const fatigueWave = 0.5 + 0.45 * Math.sin(t / 14);
  const scenario = CONTACT_SCENARIOS[Math.floor(t / 40) % CONTACT_SCENARIOS.length];
  const contact = (e: Electrode): ContactQuality => scenario[e] ?? "good";

  const raw = map((e) => {
    if (contact(e) !== "good") return 0; // no reliable activity
    const base = 0.45 + 0.3 * Math.sin(t * 0.9 + PHASES[e]) + 0.15 * Math.sin(t * 2.3 + PHASES[e] * 2);
    // Occipital channels (O1/O2) light up more with fatigue – alpha waves
    const occipitalBoost = e.startsWith("O") ? fatigueWave * 0.3 : 0;
    return clamp01(base + occipitalBoost + (Math.random() - 0.5) * 0.2);
  });
  smoothed = smoothed ? map((e) => smoothed![e] * 0.55 + raw[e] * 0.45) : raw;

  const ptpUv = map((e) => {
    const q = contact(e);
    if (q === "none") return 0;
    if (q === "poor") return 40_000 + Math.random() * 420_000; // saturation as in the screenshot
    return 25 + smoothed![e] * 90 + Math.random() * 15; // physiological 25–130 µV
  });

  const theta = clamp01(0.3 + fatigueWave * 0.5 + (Math.random() - 0.5) * 0.08);
  const alpha = clamp01(0.35 + fatigueWave * 0.45 + (Math.random() - 0.5) * 0.08);
  const beta = clamp01(0.75 - fatigueWave * 0.45 + (Math.random() - 0.5) * 0.08);
  const fatigueScore = clamp01((theta + alpha) / Math.max(beta, 0.1) / 4);

  if (fatigueScore > 0.72) stopLatched = true;
  else if (fatigueScore < 0.62) stopLatched = false;

  // Accelerometer: head almost still, slow "nodding" (pitch) when fatigued
  const nod = fatigueWave > 0.8 ? 0.15 * Math.sin(t * 0.8) : 0;
  const accel = {
    x: 0.02 * Math.sin(t * 0.7) + (Math.random() - 0.5) * 0.01,
    y: nod + (Math.random() - 0.5) * 0.01,
    z: 0.98 + (Math.random() - 0.5) * 0.01,
  };

  // BRI from EEG: smoothed fatigue index on a 0..100 scale (the backend will compute it from band power)
  briSmoothed = briSmoothed === null ? fatigueScore * 100 : briSmoothed * 0.8 + fatigueScore * 100 * 0.2;


  return {
    tMs: nowMs,
    bri: Math.round(briSmoothed * 10) / 10,
    channels: smoothed,
    ptpUv,
    // we deliberately do NOT send quality – the frontend computes it from PTP (the backend may override it)
    bands: { theta, alpha, beta },
    fatigueScore,
    shouldStop: stopLatched,
    accel,
  };
}
