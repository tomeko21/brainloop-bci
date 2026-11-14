/**
 * ============================================================
 *  TUNING – every number worth fine-tuning, in one file.
 * ============================================================
 * Change a value, save – Vite hot-reloads the app. Units are in the names (Ms = milliseconds).
 */

/**
 * Calm filter: softens playback once brainrot is detected (BRI ≥ 70 for 15 s), slowly, and releases slowly.
 * Never changes which reels are shown (the feed's recommender is independent – see backend reel_selector.py).
 */
export const CALM_FILTER = {
  // ---- When it switches on (brainrot detected) ----
  /** BRI (0..100) threshold = "brainrot". 25 = this person at rest (fixation cross). */
  briThreshold: 70,
  /** BRI must stay at/above the threshold this long before the filter starts (no reaction to one bad moment). */
  onsetDelayMs: 15_000,
  /** Once on: intensity target at the threshold … */
  intensityAtThreshold: 0.5,
  /** … growing linearly to full strength at this BRI. */
  briFull: 90,
  /** Switches off again only after BRI stays below this value … */
  briRelease: 60,
  /** … for this long (hysteresis: no flicker around 70). Missing BRI counts as "below". */
  releaseDelayMs: 20_000,

  // ---- Effect at FULL intensity (0% = no change, linear in between) ----
  /** Colour saturation of the colour overlay: 1 = normal -> 0.1 (almost B&W, 10% colour kept). */
  minSaturation: 0.1,
  /** Contrast of the colour overlay: 1 -> 0.85. */
  minContrast: 0.85,
  /** Playback speed: 1.0× -> 0.7× (browser keeps the pitch, so music still sounds right). */
  minPlaybackRate: 0.7,
  /** Volume: 1.0 -> 0.6. */
  minVolume: 0.6,

  // ---- Timing ("delay") ----
  /** How fast the effect fades IN (intensity per second): 1/45 = full strength after ~45 s. */
  rampUpPerSec: 1 / 45,
  /** How fast it fades OUT when BRI drops: 1/30 = gone after ~30 s. */
  rampDownPerSec: 1 / 30,
  /** Switching the filter OFF in Settings removes the effect immediately (true) or fades it out (false). */
  instantOff: true,
  /** How often the intensity is recomputed. */
  tickMs: 250,
  /** CSS transition of the colour overlay between ticks (smooths the steps). */
  overlayTransitionMs: 300,

  // ---- Reminder ----
  /** "You've been scrolling for X min" every N ms (only when the filter is enabled). */
  reminderEveryMs: 5 * 60_000,
  /** How long the reminder stays on screen. */
  reminderVisibleMs: 10_000,
} as const;

/**
 * Resting EEG baseline: the feed starts with a fixation cross. BRI 25 = this person at rest,
 * so every later BRI value means "compared to how YOUR brain looked while relaxed".
 */
export const BASELINE = {
  /** How long the cross is shown (the backend needs ≥ 10 s of artifact-free signal out of it). */
  durationMs: 30_000,
  /** Screen colours: neutral grey background, black cross (classic resting-state protocol). */
  background: "#9a9a9a",
  crossColor: "#000000",
  /** Show a "Skip" button when no EEG headset is streaming (nothing to calibrate). */
  allowSkipWithoutHeadset: true,
} as const;

/** Feed behaviour. */
export const FEED = {
  /** Reels per request – the backend picks them in batches, so the API is not hit on every swipe. */
  pageSize: 5,
  /**
   * Load the next batch when this many reels are left before the end. The backend picks the batch at that
   * moment from the latest BRI + engagement, so a smaller value = reels chosen from a fresher state.
   */
  prefetchWhenLeft: 2,
  /** Double tap window for "like" (ms). */
  doubleTapMs: 280,
  /** Pull-to-refresh: pull distance (px) needed to refresh, and the maximum pull. */
  pullThresholdPx: 72,
  pullMaxPx: 120,
} as const;

/** Video playback bookkeeping. */
export const PLAYBACK = {
  /** How often the video time is pushed to the store (progress bar, watch %, loops). */
  syncEveryMs: 100,
  /** Biggest time jump still counted as "played" (bigger = seek / tab was asleep). */
  maxStepMs: 1_500,
} as const;

/** Data collection rates. */
export const TRACKING = {
  /** Face features per second (MediaPipe). 10 Hz = good performance/data trade-off. */
  faceSampleHz: 10,
  /** Scroll speed sample every N ms (only while the user is scrolling). */
  scrollSampleMs: 100,
  /** Heartbeat from the feed to the backend (admin panel live view). */
  heartbeatMs: 2_000,
  /** Window for blink rate and PERCLOS. */
  eyeWindowMs: 60_000,
  /** Camera frames to the backend: one frame every N ms (2 fps)… */
  frameCaptureMs: 500,
  /** …uploaded in batches every N ms. */
  frameBatchMs: 2_000,
  /** Frame width (px) and JPEG quality – ~10–20 KB per frame. */
  frameWidth: 320,
  frameJpegQuality: 0.7,
  /** If the backend is slow, keep at most this many frames waiting (oldest are dropped). */
  frameMaxBuffered: 12,
} as const;

/** BRI prediction from camera + scroll. */
export const ML = {
  /** Ask the model every N ms… */
  predictEveryMs: 2_000,
  /** …with features from the last N ms. */
  windowMs: 10_000,
} as const;

/** Local safety copy of the session data (IndexedDB). */
export const STORAGE = {
  autosaveMs: 1_000,
} as const;

/** Small UI timings. */
export const UI = {
  /** Fade-in of Settings / other pages when switching tabs. */
  pageFadeMs: 180,
} as const;
