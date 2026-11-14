/**
 * One reel: video player, tap = pause, double tap = like, caption + actions overlay.
 */
import { AnimatePresence, motion } from "motion/react";
import { Pause, Play } from "lucide-react";
import { useRef, useState } from "react";
import { FEED } from "@/config/tuning";
import type { Reel } from "@/types/domain";
import { logEvent } from "@/store/csvLogStore";
import { usePlaybackStore } from "@/store/playbackStore";
import { useSettingsStore } from "@/store/settingsStore";
import { FeedProgressBar } from "./ProgressBar";
import { ReelPlayer } from "./ReelPlayer";
import { ReelActions } from "./ReelActions";
import { ReelMeta } from "./ReelMeta";
import { HeartBurst } from "./HeartBurst";

interface Props {
  reel: Reel;
  index: number;
  active: boolean;
  /** Active reel or its direct neighbour – only these mount a <video> (preloading the next one). */
  near: boolean;
  /** False while the user is on another tab – the reel pauses (and keeps its position). */
  feedVisible: boolean;
  onLike: (reel: Reel, like: boolean) => void;
}

const DOUBLE_TAP_MS = FEED.doubleTapMs;

export function ReelCard({ reel, index, active, near, feedVisible, onLike }: Props) {
  const muted = useSettingsStore((s) => s.muted);
  // Pause lives in the playback clock (resets when the reel changes)
  const paused = usePlaybackStore((s) => active && s.reelId === reel.id && s.paused);
  const [burst, setBurst] = useState(0);
  const [flash, setFlash] = useState<"play" | "pause" | null>(null);
  const tapTimer = useRef<number | null>(null);

  const handleTap = () => {
    if (tapTimer.current) {
      // Double tap -> like (only adds, like on Instagram)
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      setBurst((b) => b + 1);
      if (!reel.likedByMe) onLike(reel, true);
      return;
    }
    tapTimer.current = window.setTimeout(() => {
      tapTimer.current = null;
      if (!active) return;
      const next = !usePlaybackStore.getState().paused;
      usePlaybackStore.getState().setPaused(next);
      logEvent(next ? "reel_pause" : "reel_resume", { reelId: reel.id });
      setFlash(next ? "pause" : "play");
    }, DOUBLE_TAP_MS);
  };

  return (
    <section
      data-index={index}
      className="relative h-full w-full shrink-0 snap-start snap-always overflow-hidden"
      onClick={handleTap}
    >
      <ReelPlayer
        reel={reel}
        playing={active && !paused && feedVisible}
        mountVideo={near}
        muted={muted}
        trackPlayback={active}
        rewind={!active}
        progressBar={<FeedProgressBar reelId={reel.id} />}
      />
      <HeartBurst burstKey={burst} />

      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash + burst + String(paused)}
            className="pointer-events-none absolute inset-0 z-10 grid place-items-center"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.4 }}
            onAnimationComplete={() => setTimeout(() => setFlash(null), 250)}
          >
            <div className="grid size-20 place-items-center rounded-full bg-black/40 backdrop-blur-md">
              {flash === "pause" ? <Pause className="size-9 fill-white text-white" /> : <Play className="size-9 fill-white text-white" />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="absolute inset-x-0 bottom-0 z-10 flex items-end gap-4 p-4 pb-24"
        initial={false}
        animate={{ opacity: active ? 1 : 0.4, y: active ? 0 : 16 }}
        transition={{ duration: 0.4 }}
      >
        <div className="min-w-0 flex-1">
          <ReelMeta reel={reel} />
        </div>
        <ReelActions reel={reel} onToggleLike={() => onLike(reel, !reel.likedByMe)} />
      </motion.div>
    </section>
  );
}
