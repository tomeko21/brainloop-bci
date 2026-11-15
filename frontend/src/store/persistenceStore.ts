import { create } from "zustand";

interface PersistenceState {
  lastSavedAtMs: number | null;
  restoredRows: number;  // rows restored after a refresh
  restoredSegments: number;
  error: string | null;
  patch: (p: Partial<Omit<PersistenceState, "patch">>) => void;
}

export const usePersistenceStore = create<PersistenceState>()((set) => ({
  lastSavedAtMs: null,
  restoredRows: 0,
  restoredSegments: 0,
  error: null,
  patch: (p) => set(p),
}));
