import { create } from "zustand";

/** Live state of the calm filter (not persisted). */
interface CalmState {
  /** Current, smoothly ramped intensity 0..1 – applied to the video. */
  intensity: number;
  /** Where the intensity is heading (from BRI or the preview slider). */
  target: number;
  /** Manual preview from Settings (0..1) – overrides BRI; null = automatic. */
  preview: number | null;
  set: (p: Partial<Pick<CalmState, "intensity" | "target" | "preview">>) => void;
}

export const useCalmStore = create<CalmState>()((set) => ({
  intensity: 0,
  target: 0,
  preview: null,
  set: (p) => set(p),
}));
