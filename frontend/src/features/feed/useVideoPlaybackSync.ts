import { useEffect } from "react";
import { PLAYBACK } from "@/config/tuning";
import { logEvent } from "@/store/csvLogStore";
import { usePlaybackStore } from "@/store/playbackStore";

/** How often the video time is pushed to the store (the progress bar animates in between). */
const SYNC_EVERY_MS = PLAYBACK.syncEveryMs;

/**
 * Feeds the active reel's <video> time into the playback store ~10×/s
 * (progress bar, watch %, loops). A wrap-around = the reel finished and started again.
 */
export function useVideoPlaybackSync(video: React.RefObject<HTMLVideoElement | null>, reelId: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < SYNC_EVERY_MS) return;
      last = now;
      const v = video.current;
      const store = usePlaybackStore.getState();
      if (v && store.reelId === reelId && v.readyState >= 2) {
        if (store.syncVideo(v.currentTime, v.duration)) {
          logEvent("reel_loop", { reelId, value: usePlaybackStore.getState().loops });
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [video, reelId, enabled]);
}
