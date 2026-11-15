import { create } from "zustand";

interface CalmState {
  intensity: number;  // 0..1, ramped, applied to the video
  target: number;
  preview: number | null;  // Settings preview slider, overrides BRI when set
  set: (p: Partial<Pick<CalmState, "intensity" | "target" | "preview">>) => void;
}

export const useCalmStore = create<CalmState>()((set) => ({
  intensity: 0,
  target: 0,
  preview: null,
  set: (p) => set(p),
}));
