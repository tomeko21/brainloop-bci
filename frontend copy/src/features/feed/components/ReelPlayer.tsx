// Reel <video> used by the feed and the admin mirror. Videos are served by the backend under /media/videos/.
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { mediaUrl } from "@/api/client";
import { usePlaybackStore } from "@/store/playbackStore";
import { useCalmStore } from "@/store/calmStore";
import { CALM_FILTER, calmEffect } from "@/config/calmFilter";
import type { Reel } from "@/types/domain";
import { useVideoPlaybackSync } from "../useVideoPlaybackSync";

interface Props {
  reel: Reel;
  playing: boolean;
  calmIntensity?: number; // omitted = this device's calm filter, the admin mirror passes the viewer's value
  mountVideo?: boolean;
  muted?: boolean;
  trackPlayback?: boolean;
  rewind?: boolean;
  syncTimeSec?: number | null;
  progressBar?: React.ReactNode;
}

export function ReelPlayer({
  reel, playing, calmIntensity, mountVideo = true, muted = false, trackPlayback, rewind, syncTimeSec, progressBar,
}: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  // a freshly loaded video resets playbackRate to 1, so the calm effect gets reapplied
  const reapplyCalm = useRef<() => void>(() => undefined);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [h1, h2] = reel.palette;
  const audioBlocked = usePlaybackStore((s) => s.audioBlocked);

  useVideoPlaybackSync(video, reel.id, !!trackPlayback && mountVideo);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (!playing) {
      v.pause();
      return;
    }
    v.muted = muted || audioBlocked;
    v.play().catch(() => {
      v.muted = true;
      if (!muted) usePlaybackStore.getState().setAudioBlocked(true);
      void v.play().catch(() => undefined);
    });
  }, [playing, muted, audioBlocked, mountVideo]);

  useEffect(() => {
    if (rewind && video.current) video.current.currentTime = 0;
  }, [rewind]);

  useEffect(() => {
    if (!mountVideo) return;
    const apply = (intensity: number) => {
      const e = calmEffect(intensity);
      const o = overlay.current;
      if (o) {
        const f = intensity > 0.001 ? `saturate(${e.saturation.toFixed(3)}) contrast(${e.contrast.toFixed(3)})` : "none";
        o.style.backdropFilter = f;
        o.style.setProperty("-webkit-backdrop-filter", f);
      }
      const v = video.current;
      if (!v) return;
      if (Math.abs(v.playbackRate - e.playbackRate) > 0.001) {
        v.defaultPlaybackRate = e.playbackRate; // survives pause/play and re-buffering
        v.playbackRate = e.playbackRate;
      }
      v.volume = e.volume;
    };
    if (calmIntensity !== undefined) {
      reapplyCalm.current = () => apply(calmIntensity);
      apply(calmIntensity);
      return;
    }
    reapplyCalm.current = () => apply(useCalmStore.getState().intensity);
    apply(useCalmStore.getState().intensity);
    return useCalmStore.subscribe((s, prev) => s.intensity !== prev.intensity && apply(s.intensity));
  }, [calmIntensity, mountVideo]);

  useEffect(() => {
    const v = video.current;
    if (v && syncTimeSec != null && Number.isFinite(v.duration) && Math.abs(v.currentTime - syncTimeSec) > 1.5) {
      v.currentTime = syncTimeSec % v.duration;
    }
  }, [syncTimeSec]);

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: `linear-gradient(135deg, hsl(${h1} 70% 16%), hsl(${h2} 65% 8%) 60%, #000)` }}
    >
      {mountVideo && (
        <video
          ref={video}
          src={mediaUrl(reel.videoUrl)}
          className="absolute inset-0 size-full object-contain"
          playsInline
          loop
          muted={muted || audioBlocked}
          preload="auto"
          onLoadedData={() => {
            setState("ready");
            reapplyCalm.current();
          }}
          onWaiting={() => setState((s) => (s === "error" ? s : "loading"))}
          onPlaying={() => setState("ready")}
          onError={() => setState("error")}
        />
      )}

      <div
        ref={overlay}
        className="pointer-events-none absolute inset-0"
        style={{ transition: `backdrop-filter ${CALM_FILTER.overlayTransitionMs}ms linear` }}
      />

      <AnimatePresence>
        {state !== "ready" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 grid place-items-center text-white/70"
          >
            {state === "error" ? (
              <span className="flex items-center gap-2 text-sm"><AlertTriangle className="size-4" /> Video unavailable</span>
            ) : (
              mountVideo && <Loader2 className="size-8 animate-spin" />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(0_0_0/0.55))]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />

      <div className="absolute inset-x-3 top-3 h-[3px] overflow-hidden rounded-full bg-white/20">{progressBar}</div>

      {!playing && mountVideo && state === "ready" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pointer-events-none absolute inset-0 bg-black/25" />
      )}
    </div>
  );
}
