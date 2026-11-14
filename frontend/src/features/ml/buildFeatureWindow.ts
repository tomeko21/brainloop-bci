import { faceTable, reelViewsTable, scrollTable } from "@/services/dataLogger/tables";
import { useCsvLogStore } from "@/store/csvLogStore";
import type { MlFeatureWindow } from "@/types/domain";

import { ML } from "@/config/tuning";

export const WINDOW_MS = ML.windowMs;

/** Rows from the end of the array newer than `since` (arrays grow over time -> scan from the end). */
function tail<T extends { ts_ms: number }>(rows: readonly T[], since: number): T[] {
  let i = rows.length;
  while (i > 0 && rows[i - 1].ts_ms >= since) i--;
  return rows.slice(i);
}

const mean = (xs: number[]) => {
  const v = xs.filter(Number.isFinite);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
};
const std = (xs: number[]) => {
  const m = mean(xs);
  const v = xs.filter(Number.isFinite);
  return v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) : NaN;
};

/**
 * Feature vector from the last 10 s – the same for training (ml_windows.csv) and prediction.
 * TODO(team): if you add/remove features for the camera model, change them here, in MlFeatureWindow
 * (types/domain/ml.ts + backend/app/schemas.py) and in the ml_windows columns – training and inference
 * must use exactly the same features.
 */
export function buildFeatureWindow(sessionId: string, now = Date.now()): MlFeatureWindow {
  const start = now - WINDOW_MS;
  const face = tail(faceTable.snapshot(), start);
  const seen = face.filter((r) => r.face_present === 1);
  const scroll = tail(scrollTable.snapshot(), start);
  const views = reelViewsTable.snapshot().slice(-5);
  const likes = useCsvLogStore
    .getState()
    .rows.filter((r) => r.sessionId === sessionId && r.event === "reel_like" && r.tsMs >= start).length;

  return {
    sessionId,
    windowStartMs: start,
    windowEndMs: now,
    facePresentRatio: face.length ? seen.length / face.length : 0,
    earMean: mean(seen.map((r) => r.ear_avg)),
    blinkRatePerMin: seen.length ? seen[seen.length - 1].blink_rate_per_min : NaN,
    perclos: seen.length ? seen[seen.length - 1].perclos_60s : NaN,
    headPitchMean: mean(seen.map((r) => r.head_pitch_deg)),
    headMotion: (std(seen.map((r) => r.nose_x)) + std(seen.map((r) => r.nose_y))) / 2,
    jawOpenMax: seen.length ? Math.max(...seen.map((r) => r.jaw_open).filter(Number.isFinite), 0) : NaN,
    scrollSpeedMean: scroll.length ? mean(scroll.map((r) => Math.abs(r.velocity_reels_s))) : 0,
    scrollSamples: scroll.length,
    dwellMeanSec: views.length ? mean(views.map((v) => v.dwell_ms / 1000)) : NaN,
    watchPctMean: views.length ? mean(views.map((v) => v.watch_pct)) : NaN,
    likesInWindow: likes,
  };
}
