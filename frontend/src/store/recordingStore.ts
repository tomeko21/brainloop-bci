import { create } from "zustand";

export type RecordingStatus = "idle" | "requesting" | "recording" | "stopping" | "error";

/** Camera state – NOT persisted (a MediaStream does not survive a page refresh). */
interface RecordingState {
  status: RecordingStatus;
  stream: MediaStream | null;
  startedAtMs: number | null;
  error: string | null;
  patch: (p: Partial<Omit<RecordingState, "patch">>) => void;
}

export const useRecordingStore = create<RecordingState>()((set) => ({
  status: "idle",
  stream: null,
  startedAtMs: null,
  error: null,
  patch: (p) => set(p),
}));
