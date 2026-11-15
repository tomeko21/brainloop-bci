import { useEffect, useLayoutEffect, useRef } from "react";
import { TRACKING } from "@/config/tracking";
import { stamp } from "@/lib/timebase";
import { scrollTable } from "@/services/dataLogger/tables";

// Samples scroll.csv only while moving. takePeak() feeds the exit speed in reel_views.csv.
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
      if (rawDt < 16) return; // ~60 samples/s max
      // cap the gap after idle, otherwise speed gets underestimated
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
