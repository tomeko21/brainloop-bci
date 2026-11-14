import { useEffect } from "react";
import { CALM_FILTER, createBrainrotTrigger, targetIntensityForBri } from "@/config/calmFilter";
import { useCalmStore } from "@/store/calmStore";
import { logEvent } from "@/store/csvLogStore";
import { useMlStore } from "@/store/mlStore";
import { useSettingsStore } from "@/store/settingsStore";
import { bestBri } from "@/types/domain";

/**
 * Drives the calm filter intensity from the best available BRI (camera model when trained, today the EEG):
 *  1. trigger: BRI ≥ 70 for 15 s -> on; BRI < 60 for 20 s -> off (delay + hysteresis, tuning.ts),
 *  2. target intensity while on: 0.5 at BRI 70 … 1.0 at BRI 90,
 *  3. real intensity ramps towards the target slowly (≈ 45 s in, 30 s out).
 * The preview slider overrides 1–2. Trigger changes and every 10% step are logged to events.csv.
 */
export function useCalmFilter() {
  useEffect(() => {
    let last = performance.now();
    let loggedStep = Math.round(useCalmStore.getState().intensity * 10);
    const trigger = createBrainrotTrigger();

    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;

      const { intensity, preview, set } = useCalmStore.getState();
      const enabled = useSettingsStore.getState().calmFilter;
      // Disabled filter = always 0 (also ignores a leftover preview value)
      const bri = bestBri(useMlStore.getState().prediction);
      const wasActive = trigger.active;
      const active = trigger.update(bri, now);
      if (active !== wasActive) logEvent("calm_filter", { value: active ? `trigger_on;bri=${bri}` : `trigger_off;bri=${bri}` });
      const target = !enabled ? 0 : (preview ?? (active ? targetIntensityForBri(bri) : 0));

      let next = intensity;
      if (!enabled && CALM_FILTER.instantOff) next = 0; // switched off in Settings -> effect gone at once
      else if (target > intensity) next = Math.min(target, intensity + CALM_FILTER.rampUpPerSec * dt);
      else if (target < intensity) next = Math.max(target, intensity - CALM_FILTER.rampDownPerSec * dt);

      if (Math.abs(next - intensity) > 1e-4 || target !== useCalmStore.getState().target) {
        set({ intensity: next, target });
      }

      const step = Math.round(next * 10);
      if (step !== loggedStep) {
        loggedStep = step;
        logEvent("calm_filter", { value: (step / 10).toFixed(1) });
      }
    }, CALM_FILTER.tickMs);

    // Switching the filter OFF reacts immediately (not on the next tick)
    const unsub = useSettingsStore.subscribe((st, prev) => {
      if (prev.calmFilter && !st.calmFilter && CALM_FILTER.instantOff) {
        useCalmStore.getState().set({ intensity: 0, target: 0 });
      }
    });

    return () => {
      window.clearInterval(id);
      unsub();
    };
  }, []);
}
