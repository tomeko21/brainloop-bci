import { Leaf, RefreshCw, Volume2, VolumeX } from "lucide-react";
import { usePlaybackStore } from "@/store/playbackStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useCalmStore } from "@/store/calmStore";
import { Logo } from "@/components/ui";

export function FeedTopBar({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  const calmPct = useCalmStore((s) => Math.round(s.intensity * 100));
  const muted = useSettingsStore((s) => s.muted);
  const setMuted = useSettingsStore((s) => s.setMuted);
  const blocked = usePlaybackStore((s) => s.audioBlocked);
  const silent = muted || blocked;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent p-4 pt-[max(env(safe-area-inset-top),16px)] text-white">
      <Logo compact />
      <div className="flex items-center gap-4 text-sm font-medium">
        <span className="text-white/50">Following</span>
        <span className="relative">
          For You
          <span className="absolute -bottom-1.5 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-white" />
        </span>
      </div>
      <div className="pointer-events-auto flex items-center gap-2">
        {calmPct >= 2 && (
          <span
            title="Calm filter is softening playback (dopamine peak detected)"
            className="flex h-9 items-center gap-1 rounded-full bg-ok/20 px-2.5 font-mono text-xs text-ok"
          >
            <Leaf className="size-4" /> {calmPct}%
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            if (blocked) usePlaybackStore.getState().setAudioBlocked(false);
            else setMuted(!muted);
          }}
          aria-label={silent ? "Turn sound on" : "Mute"}
          className={
            "grid size-9 cursor-pointer place-items-center rounded-full backdrop-blur transition-colors " +
            (blocked ? "animate-pulse bg-neon-pink/30" : "bg-white/10 hover:bg-white/20")
          }
        >
          {silent ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh feed"
          className="grid size-9 cursor-pointer place-items-center rounded-full bg-white/10 backdrop-blur transition-colors hover:bg-white/20"
        >
          <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
        </button>
      </div>
    </div>
  );
}
