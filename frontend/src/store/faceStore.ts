import { create } from "zustand";
import type { FaceLiveSummary } from "@/types/domain";

export type FaceTrackerStatus = "off" | "loading" | "running" | "error";

/** Face feature summary for the UI (updated ~2×/s, not on every frame). */
interface FaceState {
  status: FaceTrackerStatus;
  error: string | null;
  summary: FaceLiveSummary | null;
  patch: (p: Partial<Omit<FaceState, "patch">>) => void;
}

export const useFaceStore = create<FaceState>()((set) => ({
  status: "off",
  error: null,
  summary: null,
  patch: (p) => set(p),
}));
