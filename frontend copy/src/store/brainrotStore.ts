import { create } from "zustand";
import type { StreamStatus } from "@/lib/realtime/types";
import type { BrainrotState } from "@/types/domain";

const HISTORY_S = 180;  // s of history for the trend chart

interface BrainrotStore {
  state: BrainrotState | null;
  status: StreamStatus;
  history: { t: number; bri: number | null }[];
  push: (s: BrainrotState) => void;
  setStatus: (s: StreamStatus) => void;
}

export const useBrainrotStore = create<BrainrotStore>()((set) => ({
  state: null,
  status: "closed",
  history: [],
  push: (s) =>
    set((st) => {
      const from = s.tMs - HISTORY_S * 1000;
      const history = [...st.history.filter((h) => h.t >= from), { t: s.tMs, bri: s.bri }];
      return { state: s, history };
    }),
  setStatus: (status) => set({ status }),
}));

// BRI the app acts on (calm filter, reminders), null when missing or older than 5 s
export function currentBri(): number | null {
  const s = useBrainrotStore.getState().state;
  if (!s || !s.enabled || s.bri == null) return null;
  return Date.now() - s.tMs < 5_000 ? s.bri : null;
}
