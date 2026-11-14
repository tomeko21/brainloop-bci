/**
 * Calm filter math. All numbers (thresholds, strength, timing) are in ./tuning.ts → CALM_FILTER.
 * intensity 0 = off … 1 = full effect.
 */
import { CALM_FILTER } from "./tuning";

export { CALM_FILTER };

export interface CalmEffect {
  saturation: number;
  contrast: number;
  playbackRate: number;
  volume: number;
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/** Video parameters for a given intensity 0..1. */
export function calmEffect(intensity: number): CalmEffect {
  const t = Math.max(0, Math.min(1, intensity));
  return {
    saturation: lerp(1, CALM_FILTER.minSaturation, t),
    contrast: lerp(1, CALM_FILTER.minContrast, t),
    playbackRate: lerp(1, CALM_FILTER.minPlaybackRate, t),
    volume: lerp(1, CALM_FILTER.minVolume, t),
  };
}

/** Target intensity for a BRI value (0..100) once the filter is triggered (threshold reached long enough). */
export function targetIntensityForBri(bri: number | null | undefined): number {
  if (bri == null || !Number.isFinite(bri)) return CALM_FILTER.intensityAtThreshold;
  const t = (bri - CALM_FILTER.briThreshold) / (CALM_FILTER.briFull - CALM_FILTER.briThreshold);
  return Math.max(CALM_FILTER.intensityAtThreshold, Math.min(1, lerp(CALM_FILTER.intensityAtThreshold, 1, t)));
}

/**
 * Brainrot trigger with delay + hysteresis: on after BRI ≥ briThreshold for onsetDelayMs,
 * off after BRI < briRelease (or no BRI) for releaseDelayMs.
 */
export function createBrainrotTrigger() {
  let active = false;
  let sinceMs: number | null = null; // start of the condition that would flip the state
  return {
    update(bri: number | null, nowMs: number): boolean {
      const flip = active
        ? bri === null || bri < CALM_FILTER.briRelease
        : bri !== null && bri >= CALM_FILTER.briThreshold;
      if (!flip) sinceMs = null;
      else {
        sinceMs ??= nowMs;
        if (nowMs - sinceMs >= (active ? CALM_FILTER.releaseDelayMs : CALM_FILTER.onsetDelayMs)) {
          active = !active;
          sinceMs = null;
        }
      }
      return active;
    },
    get active() {
      return active;
    },
  };
}
