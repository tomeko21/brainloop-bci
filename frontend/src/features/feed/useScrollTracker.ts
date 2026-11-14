import { useEffect, useLayoutEffect, useRef } from "react";
import { TRACKING } from "@/config/tracking";
import { stamp } from "@/lib/timebase";
import { scrollTable } from "@/services/dataLogger/tables";

/**
 * Measures feed scroll speed (px/s and reels/s) and writes samples to scroll.csv.
 * Samples only while moving, at most every TRACKING.scrollSampleMs – zero cost when idle.
 * `takePeak()` returns the peak speed since the last call (for reel_views.csv).
 */
export function useScrollTracker(container: React.RefObject<HTMLElement | null>, activeIndex: number, enabled: boolean) {
  const peak = useRef(0);
  const activeRef = useRef(activeIndex);
  useLayoutEffect(() => {
    activeRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    const el = container.current;
    if (!el || !enabled) return;
    let lastTop = el.scrollTop;
    let lastT = performance.now();
    let lastSample = 0;

    const onScroll = () => {
      const now = performance.now();
      const rawDt = now - lastT;
      if (rawDt < 16) return; // max ~60 measurements/s
      // First event after idle: don't divide by the whole gap (it would underestimate speed)
      const dt = Math.min(rawDt, 100);
      const top = el.scrollTop;
      const vPx = ((top - lastTop) / dt) * 1000;
      const vReels = vPx / Math.max(1, el.clientHeight);
      lastTop = top;
      lastT = now;
      peak.current = Math.max(peak.current, Math.abs(vReels));

      if (now - lastSample >= TRACKING.scrollSampleMs) {
        lastSample = now;
        scrollTable.append({
          ...stamp(),
          scroll_top_px: Math.round(top),
          velocity_px_s: Math.round(vPx),
          velocity_reels_s: Number(vReels.toFixed(3)),
          direction: vPx > 0 ? 1 : vPx < 0 ? -1 : 0,
          active_index: activeRef.current,
        });
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [container, enabled]);

  return {
    takePeak: () => {
      const v = peak.current;
      peak.current = 0;
      return v;
    },
  };
}
