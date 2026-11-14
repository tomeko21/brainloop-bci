import { create } from "zustand";

/** IndexedDB autosave status (for the UI). */
interface PersistenceState {
  lastSavedAtMs: number | null;
  /** How many rows were restored after a page refresh (0 = none). */
  restoredRows: number;
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
