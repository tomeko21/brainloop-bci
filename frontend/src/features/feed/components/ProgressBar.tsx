import { selectLoops, selectProgress, usePlaybackStore } from "@/store/playbackStore";

/** Pure 0..1 bar. `loop` in the key -> on looping the bar returns to 0 without a "backwards" animation. */
export function ProgressBar({ progress, loop }: { progress: number; loop: number }) {
  return (
    <div
      key={loop}
      className="h-full origin-left rounded-full bg-white shadow-[0_0_8px_white] transition-transform duration-100 ease-linear"
      style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress))})` }}
    />
  );
}

/** Active reel's bar in the feed – the only component re-rendered by the clock (10×/s). */
export function FeedProgressBar({ reelId }: { reelId: string }) {
  const progress = usePlaybackStore((s) => (s.reelId === reelId ? selectProgress(s) : 0));
  const loop = usePlaybackStore((s) => (s.reelId === reelId ? selectLoops(s) : 0));
  return <ProgressBar progress={progress} loop={loop} />;
}
