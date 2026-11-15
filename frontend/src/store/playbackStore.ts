// Playback state of the active reel, driven by the real <video> element. playedMs only grows during actual playback.
import { create } from "zustand";
import type { PlaybackSnapshot } from "@/types/domain";
import { PLAYBACK } from "@/config/tuning";

interface PlaybackState {
  reelId: string | null;
  durationMs: number;
  positionMs: number;
  playedMs: number;
  loops: number;
  paused: boolean;
  pauseCount: number;
  audioBlocked: boolean;  // autoplay with sound was blocked, muted until the user taps
  reset: (reelId: string, durationMs: number) => void;
  syncVideo: (currentSec: number, durationSec: number) => boolean;
  setPaused: (paused: boolean) => void;
  setAudioBlocked: (blocked: boolean) => void;
}

const MAX_STEP_MS = PLAYBACK.maxStepMs;

export const usePlaybackStore = create<PlaybackState>()((set, get) => ({
  reelId: null,
  durationMs: 1,
  positionMs: 0,
  playedMs: 0,
  loops: 0,
  paused: false,
  pauseCount: 0,
  audioBlocked: false,
  reset: (reelId, durationMs) =>
    set({ reelId, durationMs: Math.max(1, durationMs), positionMs: 0, playedMs: 0, loops: 0, paused: false, pauseCount: 0 }),
  syncVideo: (currentSec, durationSec) => {
    const s = get();
    const durationMs = Number.isFinite(durationSec) && durationSec > 0 ? durationSec * 1000 : s.durationMs;
    const pos = currentSec * 1000;
    let delta = pos - s.positionMs;
    let looped = false;
    // looped: count the rest of the last pass plus the start of the new one
    if (delta < -500) {
      delta = durationMs - s.positionMs + pos;
      looped = true;
    }
    set({
      durationMs,
      positionMs: pos,
      loops: s.loops + (looped ? 1 : 0),
      playedMs: s.playedMs + (delta > 0 && delta < MAX_STEP_MS ? delta : 0),
    });
    return looped;
  },
  setPaused: (paused) => set((s) => ({ paused, pauseCount: paused && !s.paused ? s.pauseCount + 1 : s.pauseCount })),
  setAudioBlocked: (audioBlocked) => set({ audioBlocked }),
}));

export function playbackSnapshot(s = usePlaybackStore.getState()): PlaybackSnapshot {
  return { positionMs: s.positionMs, durationMs: s.durationMs, loops: s.loops, paused: s.paused };
}

export const selectProgress = (s: PlaybackState) => Math.min(1, s.positionMs / s.durationMs);
export const selectLoops = (s: PlaybackState) => s.loops;
