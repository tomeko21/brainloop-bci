import { selectLoops, selectProgress, usePlaybackStore } from "@/store/playbackStore";

// `loop` goes into the key so the bar snaps back to 0 instead of animating backwards.
export function ProgressBar({ progress, loop }: { progress: number; loop: number }) {
  return (
    <div
      key={loop}
      className="h-full origin-left rounded-full bg-white shadow-[0_0_8px_white] transition-transform duration-100 ease-linear"
      style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress))})` }}
    />
  );
}

// only component re-rendered by the 10/s playback clock
export function FeedProgressBar({ reelId }: { reelId: string }) {
  const progress = usePlaybackStore((s) => (s.reelId === reelId ? selectProgress(s) : 0));
  const loop = usePlaybackStore((s) => (s.reelId === reelId ? selectLoops(s) : 0));
  return <ProgressBar progress={progress} loop={loop} />;
}
