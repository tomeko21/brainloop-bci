import { useEffect } from "react";
import { TRACKING } from "@/config/tracking";
import { logEvent } from "@/store/csvLogStore";
import { usePlaybackStore } from "@/store/playbackStore";
import type { Reel } from "@/types/domain";

/** Drives the active reel's clock; when it reaches the end the reel restarts (+ reel_loop event). */
export function usePlaybackClock(reel: Reel | undefined) {
  useEffect(() => {
    if (!reel) return;
    const store = usePlaybackStore.getState();
    store.reset(reel.id, reel.durationSec * 1000);
    let last = performance.now();

    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      // Tab in background = user is not watching – don't count time
      if (document.visibilityState !== "visible") return;
      const { looped } = usePlaybackStore.getState().tick(dt);
      if (looped) {
        const loops = Math.floor(usePlaybackStore.getState().playedMs / (reel.durationSec * 1000));
        logEvent("reel_loop", { reelId: reel.id, value: loops });
      }
    }, TRACKING.playbackTickMs);

    return () => window.clearInterval(id);
  }, [reel?.id]); // eslint-disable-line react-hooks/exhaustive-deps
}
