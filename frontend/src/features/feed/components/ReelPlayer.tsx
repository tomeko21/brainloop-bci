/**
 * Reel <video> player: play/pause, autoplay-with-sound fallback, calm filter effects
 * (colour overlay, speed, volume), playback sync for the progress bar and the admin mirror.
 */
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
  /** Should the video be playing right now. */
  playing: boolean;
  /**
   * Calm filter intensity 0..1. Omitted = follow the live calm filter of this device (feed);
   * the admin mirror passes the viewer's value from the heartbeat.
   */
  calmIntensity?: number;
  /** Mount the <video> at all (only the active reel and its neighbours – saves memory/bandwidth). */
  mountVideo?: boolean;
  muted?: boolean;
  /** Active feed reel: report time to the playback store (progress, watch %, loops). */
  trackPlayback?: boolean;
  /** Jump back to the start (feed: the reel is no longer the active one). */
  rewind?: boolean;
  /** Admin mirror: keep the video near this position (seconds). */
  syncTimeSec?: number | null;
  progressBar?: React.ReactNode;
}

/**
 * Reel video from the backend (/media/videos/...). Loops forever; the dataset videos are mostly
 * landscape, so they are shown "contain" over the reel's colour gradient.
 */
export function ReelPlayer({
  reel, playing, calmIntensity, mountVideo = true, muted = false, trackPlayback, rewind, syncTimeSec, progressBar,
}: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  /** Re-applies the current calm effect – a freshly loaded video resets its playbackRate to 1. */
  const reapplyCalm = useRef<() => void>(() => undefined);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [h1, h2] = reel.palette;
  const audioBlocked = usePlaybackStore((s) => s.audioBlocked);

  useVideoPlaybackSync(video, reel.id, !!trackPlayback && mountVideo);

  // Play / pause; if the browser blocks autoplay with sound, fall back to muted
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

  // Reels that are no longer active rewind, so coming back starts from the beginning
  useEffect(() => {
    if (rewind && video.current) video.current.currentTime = 0;
  }, [rewind]);

  // Calm filter, applied without touching the video's source or time (no reload, no restart, no re-render):
  //  - colours/contrast: an OVERLAY above the video (backdrop-filter), the <video> itself is untouched,
  //  - speed/volume: changed live on the playing element.
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
        v.defaultPlaybackRate = e.playbackRate; // survives a pause/play or a re-buffer
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

  // Admin mirror: follow the viewer's position (correct only bigger drift, to avoid stutter)
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

      {/* Calm filter colour overlay (desaturates / flattens whatever is under it) */}
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

      {/* Vignette + bottom gradient so captions stay readable */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(0_0_0/0.55))]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />

      <div className="absolute inset-x-3 top-3 h-[3px] overflow-hidden rounded-full bg-white/20">{progressBar}</div>

      {!playing && mountVideo && state === "ready" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pointer-events-none absolute inset-0 bg-black/25" />
      )}
    </div>
  );
}
