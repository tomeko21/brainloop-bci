import { motion } from "motion/react";
import type { Reel } from "@/types/domain";
import { cn } from "@/lib/cn";

interface Props {
  reel: Reel;
  playing: boolean;
  calm: boolean;
  /** Progress bar – the feed attaches the playback clock, admin the position from the heartbeat. */
  progressBar?: React.ReactNode;
}

/**
 * "Fake" video player – instead of a file we have an animated scene
 * built from the reel's palette. Progress is counted by the clock (store/playbackStore) – at the end the reel restarts.
 * Once we get real video, just drop in a <video> here.
 */
export function ReelPlayer({ reel, playing, calm, progressBar }: Props) {
  const [h1, h2] = reel.palette;
  const speed = calm ? 2 : reel.mood === "intense" ? 0.6 : 1;
  const playState = playing ? "running" : "paused";

  return (
    <div
      className={cn("absolute inset-0 overflow-hidden transition-[filter] duration-700", calm && "saturate-[0.55] brightness-90")}
      style={{
        background: `linear-gradient(135deg, hsl(${h1} 80% 18%), hsl(${h2} 75% 10%) 60%, hsl(${(h1 + 180) % 360} 70% 8%))`,
      }}
    >
      {/* Drifting blobs of light */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute size-[70%] animate-float-slow rounded-full blur-3xl"
          style={{
            background: `hsl(${i === 1 ? h2 : h1} 90% 55% / 0.45)`,
            left: `${[-10, 40, 10][i]}%`,
            top: `${[-5, 30, 55][i]}%`,
            animationDuration: `${(10 + i * 4) * speed}s`,
            animationDelay: `${-i * 3}s`,
            animationPlayState: playState,
          }}
        />
      ))}

      {/* Central visualization depending on mood */}
      <div className="absolute inset-0 grid place-items-center">
        {reel.mood === "calm" ? (
          <div className="relative size-48">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="absolute inset-0 rounded-full border border-white/30"
                style={{ animation: `pulse-ring ${3.2 * speed}s ease-out ${i * 0.8}s infinite`, animationPlayState: playState }}
              />
            ))}
            <span className="absolute inset-[38%] rounded-full bg-white/70 blur-md" />
          </div>
        ) : (
          <div className="flex h-40 items-end gap-1.5">
            {Array.from({ length: 18 }, (_, i) => (
              <span
                key={i}
                className="w-2 origin-bottom rounded-full bg-white/70"
                style={{
                  height: `${30 + ((i * 37) % 70)}%`,
                  animation: `eq ${(0.5 + ((i * 13) % 7) / 10) * speed}s ease-in-out ${i * 0.05}s infinite alternate`,
                  animationPlayState: playState,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Grain + vignette for a "cinematic" look */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgb(0_0_0/0.65))]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />

      {/* "Video" progress bar */}
      <div className="absolute inset-x-3 top-3 h-[3px] overflow-hidden rounded-full bg-white/20">{progressBar}</div>

      <style>{`
        @keyframes eq { from { transform: scaleY(0.15); } to { transform: scaleY(1); } }
        @keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 0.7; } 100% { transform: scale(2.2); opacity: 0; } }
      `}</style>

      {!playing && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/25" />
      )}
    </div>
  );
}
