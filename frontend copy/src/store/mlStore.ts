import { create } from "zustand";
import type { MlPrediction } from "@/types/domain";

interface MlState {
  prediction: MlPrediction | null;
  error: string | null;
  patch: (p: Partial<Omit<MlState, "patch">>) => void;
}

export const useMlStore = create<MlState>()((set) => ({
  prediction: null,
  error: null,
  patch: (p) => set(p),
}));
