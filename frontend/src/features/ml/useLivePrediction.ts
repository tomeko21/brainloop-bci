import { useEffect } from "react";
import { usePredictWindow } from "@/hooks/useMl";
import { stamp } from "@/lib/timebase";
import { mlWindowsTable } from "@/services/dataLogger/tables";
import { useMlStore } from "@/store/mlStore";
import { selectIsActive, useSessionStore } from "@/store/sessionStore";
import { buildFeatureWindow } from "./buildFeatureWindow";

export const PREDICT_EVERY_MS = 2_000;

const r4 = (v: number) => (Number.isFinite(v) ? Math.round(v * 10_000) / 10_000 : NaN);

/**
 * Every 2 s: feature window from the last 10 s -> model (API) -> AI BRI.
 * The result goes to mlStore (heartbeat to admin) and to ml_windows.csv (features + response).
 */
export function useLivePrediction() {
  const sessionId = useSessionStore((s) => (selectIsActive(s) ? s.session!.id : null));
  const { mutateAsync } = usePredictWindow();

  useEffect(() => {
    if (!sessionId) return;
    let busy = false;
    const id = window.setInterval(async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const f = buildFeatureWindow(sessionId);
        const p = await mutateAsync(f);
        useMlStore.getState().patch({ prediction: p, error: null });
        mlWindowsTable.append({
          ...stamp(p.predictedAtMs),
          window_start_ms: f.windowStartMs,
          window_end_ms: f.windowEndMs,
          face_present_ratio: r4(f.facePresentRatio),
          ear_mean: r4(f.earMean),
          blink_rate_per_min: r4(f.blinkRatePerMin),
          perclos: r4(f.perclos),
          head_pitch_mean: r4(f.headPitchMean),
          head_motion: r4(f.headMotion),
          jaw_open_max: r4(f.jawOpenMax),
          scroll_speed_mean: r4(f.scrollSpeedMean),
          scroll_samples: f.scrollSamples,
          dwell_mean_sec: r4(f.dwellMeanSec),
          watch_pct_mean: r4(f.watchPctMean),
          likes_in_window: f.likesInWindow,
          bri_ai: p.bri,
          should_stop: p.shouldStop ? 1 : 0,
          model_version: p.modelVersion,
        });
      } catch (e) {
        useMlStore.getState().patch({ error: e instanceof Error ? e.message : "Prediction error" });
      } finally {
        busy = false;
      }
    }, PREDICT_EVERY_MS);
    return () => window.clearInterval(id);
  }, [sessionId, mutateAsync]);
}
