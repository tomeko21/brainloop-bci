import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CsvEventType, CsvRow } from "@/types/domain";
import { rowsToCsv } from "@/lib/csv";
import { timeOrigin } from "@/lib/timebase";
import { useSessionStore } from "./sessionStore";

const MAX_ROWS = 50_000;

interface CsvLogState {
  /** Global log of discrete events (events.csv). Persisted – few rows. */
  rows: CsvRow[];
  log: (event: CsvEventType, opts?: { reelId?: string; value?: string | number; tsMs?: number }) => void;
  clear: () => void;
  toCsv: (sessionId?: string) => string;
}

export const useCsvLogStore = create<CsvLogState>()(
  persist(
    (set, get) => ({
      rows: [],
      log: (event, opts = {}) => {
        const session = useSessionStore.getState().session;
        const tsMs = opts.tsMs ?? Date.now();
        // Relative time counted from the recording start – lets you match a row to a video frame
        const origin = timeOrigin(tsMs);
        const row: CsvRow = {
          sessionId: session?.id ?? "",
          subjectName: session?.subjectName ?? "",
          event,
          reelId: opts.reelId ?? "",
          tsMs,
          tRelMs: tsMs - origin,
          value: opts.value === undefined ? "" : String(opts.value),
        };
        set((s) => ({ rows: [...s.rows, row].slice(-MAX_ROWS) }));
      },
      clear: () => set({ rows: [] }),
      toCsv: (sessionId) => rowsToCsv(sessionId ? get().rows.filter((r) => r.sessionId === sessionId) : get().rows),
    }),
    { name: "brainloop.csv-log" },
  ),
);

/** Convenient shortcut outside components. */
export const logEvent: CsvLogState["log"] = (...args) => useCsvLogStore.getState().log(...args);
