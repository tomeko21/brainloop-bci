import { useEffect } from "react";
import { CALM_FILTER, createBrainrotTrigger, targetIntensityForBri } from "@/config/calmFilter";
import { useCalmStore } from "@/store/calmStore";
import { logEvent } from "@/store/csvLogStore";
import { currentBri } from "@/store/brainrotStore";
import { useMlStore } from "@/store/mlStore";
import { useSettingsStore } from "@/store/settingsStore";
import { bestBri } from "@/types/domain";

// BRI >= 70 for 15 s turns the filter on, < 60 for 20 s turns it off (CALM_FILTER in tuning.ts).
// Intensity ramps slowly toward the target, roughly 45 s in and 30 s out. Changes are logged to events.csv.
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
      const bri = currentBri() ?? bestBri(useMlStore.getState().prediction);
      const wasActive = trigger.active;
      const active = trigger.update(bri, now);
      if (active !== wasActive) logEvent("calm_filter", { value: active ? `trigger_on;bri=${bri}` : `trigger_off;bri=${bri}` });
      const target = !enabled ? 0 : (preview ?? (active ? targetIntensityForBri(bri) : 0));

      let next = intensity;
      if (!enabled && CALM_FILTER.instantOff) next = 0; // switched off in Settings, drop it at once
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

    // react to the Settings toggle right away, not on the next tick
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
