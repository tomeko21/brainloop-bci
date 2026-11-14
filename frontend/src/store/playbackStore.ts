import { create } from "zustand";
import type { PlaybackSnapshot } from "@/types/domain";

/**
 * Playback clock of the ACTIVE reel (not persisted).
 * playedMs grows only while the reel is playing and the tab is visible.
 * When it reaches the end, the reel restarts (loops++).
 */
interface PlaybackState {
  reelId: string | null;
  durationMs: number;
  playedMs: number;
  paused: boolean;
  pauseCount: number;
  reset: (reelId: string, durationMs: number) => void;
  tick: (dtMs: number) => { looped: boolean };
  setPaused: (paused: boolean) => void;
}

export const usePlaybackStore = create<PlaybackState>()((set, get) => ({
  reelId: null,
  durationMs: 1,
  playedMs: 0,
  paused: false,
  pauseCount: 0,
  reset: (reelId, durationMs) => set({ reelId, durationMs: Math.max(1, durationMs), playedMs: 0, paused: false, pauseCount: 0 }),
  tick: (dtMs) => {
    const { playedMs, durationMs, paused } = get();
    if (paused) return { looped: false };
    const next = playedMs + dtMs;
    set({ playedMs: next });
    return { looped: Math.floor(next / durationMs) > Math.floor(playedMs / durationMs) };
  },
  setPaused: (paused) => set((s) => ({ paused, pauseCount: paused && !s.paused ? s.pauseCount + 1 : s.pauseCount })),
}));

export function playbackSnapshot(s = usePlaybackStore.getState()): PlaybackSnapshot {
  return {
    positionMs: s.playedMs % s.durationMs,
    durationMs: s.durationMs,
    loops: Math.floor(s.playedMs / s.durationMs),
    paused: s.paused,
  };
}

export const selectProgress = (s: PlaybackState) => (s.playedMs % s.durationMs) / s.durationMs;
export const selectLoops = (s: PlaybackState) => Math.floor(s.playedMs / s.durationMs);
