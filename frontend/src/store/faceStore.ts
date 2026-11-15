import { create } from "zustand";
import type { FaceLiveSummary } from "@/types/domain";

export type FaceTrackerStatus = "off" | "loading" | "running" | "error";

interface FaceState {
  status: FaceTrackerStatus;
  error: string | null;
  summary: FaceLiveSummary | null;  // refreshed ~2x/s, not every frame
  patch: (p: Partial<Omit<FaceState, "patch">>) => void;
}

export const useFaceStore = create<FaceState>()((set) => ({
  status: "off",
  error: null,
  summary: null,
  patch: (p) => set(p),
}));
