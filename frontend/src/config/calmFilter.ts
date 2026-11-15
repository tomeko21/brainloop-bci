// Calm filter math. All numbers come from CALM_FILTER in tuning.ts, intensity goes from 0 (off) to 1 (full).
import { CALM_FILTER } from "./tuning";

export { CALM_FILTER };

export interface CalmEffect {
  saturation: number;
  contrast: number;
  playbackRate: number;
  volume: number;
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

export function calmEffect(intensity: number): CalmEffect {
  const t = Math.max(0, Math.min(1, intensity));
  return {
    saturation: lerp(1, CALM_FILTER.minSaturation, t),
    contrast: lerp(1, CALM_FILTER.minContrast, t),
    playbackRate: lerp(1, CALM_FILTER.minPlaybackRate, t),
    volume: lerp(1, CALM_FILTER.minVolume, t),
  };
}

export function targetIntensityForBri(bri: number | null | undefined): number {
  if (bri == null || !Number.isFinite(bri)) return CALM_FILTER.intensityAtThreshold;
  const t = (bri - CALM_FILTER.briThreshold) / (CALM_FILTER.briFull - CALM_FILTER.briThreshold);
  return Math.max(CALM_FILTER.intensityAtThreshold, Math.min(1, lerp(CALM_FILTER.intensityAtThreshold, 1, t)));
}

// on after BRI >= briThreshold for onsetDelayMs, off after BRI < briRelease (or no BRI) for releaseDelayMs
export function createBrainrotTrigger() {
  let active = false;
  let sinceMs: number | null = null;  // when the condition that would flip the state started
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
