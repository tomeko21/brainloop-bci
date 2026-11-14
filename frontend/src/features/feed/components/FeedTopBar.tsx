import { Leaf, RefreshCw } from "lucide-react";
import { Logo } from "@/components/ui";

export function FeedTopBar({ calm, onRefresh, refreshing }: { calm: boolean; onRefresh: () => void; refreshing: boolean }) {
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
        {calm && (
          <span title="Calm filter active" className="grid size-9 place-items-center rounded-full bg-ok/20 text-ok backdrop-blur">
            <Leaf className="size-4" />
          </span>
        )}
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
