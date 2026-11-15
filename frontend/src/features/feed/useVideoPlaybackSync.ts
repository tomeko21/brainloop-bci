import { useEffect } from "react";
import { PLAYBACK } from "@/config/tuning";
import { logEvent } from "@/store/csvLogStore";
import { usePlaybackStore } from "@/store/playbackStore";

const SYNC_EVERY_MS = PLAYBACK.syncEveryMs;

// Pushes the active video's time into usePlaybackStore. A wrap-around counts as a loop.
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
