import { useCallback, useEffect, useRef, useState } from "react";

import { FEED } from "@/config/tuning";

const THRESHOLD = FEED.pullThresholdPx;
const MAX_PULL = FEED.pullMaxPx;

/**
 * Pull-to-refresh at the very top of the feed.
 * Touch: drag down. Mouse/trackpad: "scroll up" while on the first reel.
 */
export function usePullToRefresh(
  container: React.RefObject<HTMLElement | null>,
  onRefresh: () => Promise<unknown>,
  /** true only once the container is in the DOM (after the feed loads). */
  enabled = true,
) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const wheelReset = useRef<number | null>(null);

  const setPullBoth = (v: number) => {
    pullRef.current = v;
    setPull(v);
  };

  const trigger = useCallback(async () => {
    setRefreshing(true);
    setPullBoth(THRESHOLD * 0.8);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPullBoth(0);
    }
  }, [onRefresh]);

  useEffect(() => {
    const el = container.current;
    if (!el || !enabled) return;
    const atTop = () => el.scrollTop <= 1;

    const onTouchStart = (e: TouchEvent) => {
      startY.current = atTop() && !refreshing ? e.touches[0].clientY : null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && atTop()) {
        setPullBoth(Math.min(MAX_PULL, dy * 0.5));
        if (e.cancelable) e.preventDefault();
      } else if (pullRef.current) setPullBoth(0);
    };
    const onTouchEnd = () => {
      if (startY.current === null) return;
      startY.current = null;
      if (pullRef.current >= THRESHOLD) void trigger();
      else setPullBoth(0);
    };
    const onWheel = (e: WheelEvent) => {
      if (refreshing || !atTop() || e.deltaY >= 0) return;
      const next = Math.min(MAX_PULL, pullRef.current + Math.abs(e.deltaY) * 0.35);
      setPullBoth(next);
      if (wheelReset.current) clearTimeout(wheelReset.current);
      if (next >= THRESHOLD) {
        void trigger();
        return;
      }
      wheelReset.current = window.setTimeout(() => setPullBoth(0), 260);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, [container, refreshing, trigger, enabled]);

  return { pull, progress: Math.min(1, pull / THRESHOLD), refreshing, refresh: trigger };
}
