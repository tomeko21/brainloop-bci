// Every tunable number in one place. Vite hot-reloads on save.
// Softens playback once brainrot is detected. Never changes which reels are served, that is backend reel_selector.py.
export const CALM_FILTER = {
  briThreshold: 70,  // BRI 0..100, 25 = this person at rest
  onsetDelayMs: 15_000,  // BRI has to stay at or above the threshold this long first
  intensityAtThreshold: 0.5,  // intensity right at the threshold
  briFull: 90,  // full intensity at this BRI
  briRelease: 60,  // off again once BRI stays below this
  releaseDelayMs: 20_000,  // for this long, so it doesn't flicker. Missing BRI counts as below

  minSaturation: 0.1,  // values at full intensity, 1 = unchanged
  minContrast: 0.85,
  minPlaybackRate: 0.7,  // browser keeps the pitch
  minVolume: 0.6,

  rampUpPerSec: 1 / 45,  // intensity per second, full after ~45 s
  rampDownPerSec: 1 / 30,  // gone after ~30 s
  instantOff: true,  // turning the filter off in Settings drops the effect at once instead of fading
  tickMs: 250,  // intensity recompute interval
  overlayTransitionMs: 300,  // CSS transition between ticks

  reminderEveryMs: 5 * 60_000,  // "scrolling for X min" toast, only with the filter on
  reminderVisibleMs: 10_000,
} as const;

// Fixation cross at the start of the feed. BRI 25 is this person's resting level measured here.
export const BASELINE = {
  durationMs: 60_000,  // backend skips the first 15 s, the remaining 45 s are the baseline
  background: "#9a9a9a",  // neutral grey with a black cross, classic resting-state setup
  crossColor: "#000000",
  allowSkipWithoutHeadset: true,  // show Skip when no headset is streaming
} as const;

export const FEED = {
  pageSize: 5,  // reels per request
  prefetchWhenLeft: 2,  // fetch the next batch this many reels before the end, smaller = picked from fresher BRI
  doubleTapMs: 280,  // double tap to like
  pullThresholdPx: 72,  // pull-to-refresh distance
  pullMaxPx: 120,
} as const;

export const PLAYBACK = {
  syncEveryMs: 100,  // video time pushed to playbackStore
  maxStepMs: 1_500,  // bigger jumps are seeks or a sleeping tab, not playback
} as const;

export const TRACKING = {
  faceSampleHz: 30,  // same rate as the training recordings (data_acc), the live model expects it
  scrollSampleMs: 100,  // only while scrolling
  heartbeatMs: 2_000,  // feed to backend, admin live view
  eyeWindowMs: 60_000,  // blink rate and PERCLOS window
  frameCaptureMs: 500,  // camera frames to the backend, 2 fps
  frameBatchMs: 2_000,  // upload interval
  frameWidth: 320,  // px, roughly 10-20 KB per JPEG
  frameJpegQuality: 0.7,
  frameMaxBuffered: 12,  // oldest frames dropped when the backend is slow
} as const;

export const ML = {
  predictEveryMs: 2_000,  // /api/ml/predict-window interval
  windowMs: 10_000,  // features from the last 10 s
} as const;

export const STORAGE = {
  autosaveMs: 1_000,  // session tables to IndexedDB
} as const;

export const UI = {
  pageFadeMs: 180,  // tab switch fade
} as const;
