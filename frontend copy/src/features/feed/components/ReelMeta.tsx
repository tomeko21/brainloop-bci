import { BadgeCheck, Music2 } from "lucide-react";
import type { Reel } from "@/types/domain";

const MOOD_LABEL: Record<Reel["mood"], string> = { calm: "calm", neutral: "neutral", intense: "intense" };

export function ReelMeta({ reel }: { reel: Reel }) {
  return (
    <div className="space-y-2.5 text-white">
      <div className="flex items-center gap-2.5">
        <div
          className="size-10 rounded-full border-2 border-white/80 shadow-lg"
          style={{ background: `conic-gradient(hsl(${reel.author.avatarHue} 90% 60%), hsl(${(reel.author.avatarHue + 90) % 360} 90% 55%), hsl(${reel.author.avatarHue} 90% 60%))` }}
        />
        <span className="font-semibold">@{reel.author.handle}</span>
        {reel.author.verified && <BadgeCheck className="size-4 fill-neon-cyan text-black" />}
        <button type="button" onClick={(e) => e.stopPropagation()} className="ml-1 cursor-pointer rounded-lg border border-white/40 px-2.5 py-0.5 text-xs font-medium backdrop-blur hover:bg-white/10">
          Follow
        </button>
      </div>
      <p className="text-[15px] leading-snug drop-shadow-md">{reel.caption}</p>
      <div className="flex flex-wrap gap-1.5">
        {reel.tags.map((t) => (
          <span key={t} className="rounded-full bg-white/10 px-2 py-0.5 text-xs backdrop-blur">#{t}</span>
        ))}
        <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white/70 backdrop-blur">
          {MOOD_LABEL[reel.mood]}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-white/70">
        <Music2 className="size-3.5" />
        <span className="truncate">Original audio · {reel.author.handle}</span>
      </div>
    </div>
  );
}
