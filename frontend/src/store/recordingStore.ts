// Camera state, not persisted (a MediaStream can't survive a refresh).
import { create } from "zustand";

export type RecordingStatus = "idle" | "requesting" | "recording" | "stopping" | "error";

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
