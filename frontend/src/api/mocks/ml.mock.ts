/**
 * ============================================================
 *  MOCK AI MODEL – to be replaced by POST /api/ml/predict-window
 * ============================================================
 * This is NOT a trained model – it is a hand-written heuristic imitating LightGBM,
 * so the UI and data flow work before training.
 * Weights chosen "by eye" for known fatigue symptoms:
 * PERCLOS, rare/frequent blinking, drooping head, yawning, fast scroll, short viewing.
 */
import type { MlFactor, MlFeatureWindow, MlPrediction } from "@/types/domain";

const ok = (v: number) => Number.isFinite(v);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function mockPredict(f: MlFeatureWindow): MlPrediction {
  const factors: MlFactor[] = [];
  const add = (feature: string, contribution: number) => {
    if (Math.abs(contribution) >= 0.5) factors.push({ feature, contribution: Math.round(contribution * 10) / 10 });
  };

  if (f.facePresentRatio > 0.3) {
    if (ok(f.perclos)) add("perclos", clamp((f.perclos - 0.08) * 150, -5, 30));
    if (ok(f.blinkRatePerMin)) {
      if (f.blinkRatePerMin > 25) add("blink_rate_high", clamp((f.blinkRatePerMin - 25) * 0.8, 0, 15));
      else if (f.blinkRatePerMin < 8) add("blink_rate_low", clamp((8 - f.blinkRatePerMin) * 1.2, 0, 10));
    }
    if (ok(f.earMean)) add("eyes_narrow", clamp((0.26 - f.earMean) * 200, -5, 15));
    if (ok(f.headPitchMean) && f.headPitchMean > 10) add("head_down", clamp((f.headPitchMean - 10) * 0.8, 0, 12));
    if (ok(f.headMotion) && f.headMotion < 0.004) add("head_frozen", 8);
    if (ok(f.jawOpenMax) && f.jawOpenMax > 0.5) add("yawn", 10);
  }
  if (ok(f.scrollSpeedMean)) add("fast_scroll", clamp(f.scrollSpeedMean * 6, 0, 20));
  if (ok(f.dwellMeanSec) && f.dwellMeanSec > 0) add("short_dwell", clamp((4 - f.dwellMeanSec) * 4, -8, 16));
  if (ok(f.watchPctMean)) add("low_watch_pct", clamp((60 - f.watchPctMean) / 4, -8, 12));

  const bri = clamp(25 + factors.reduce((a, x) => a + x.contribution, 0), 0, 100);
  return {
    bri: Math.round(bri * 10) / 10,
    shouldStop: bri > 70,
    modelVersion: "mock-heuristic-0.1",
    topFactors: factors.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 4),
    predictedAtMs: Date.now(),
  };
}
