import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RecordingMeta, SessionInfo } from "@/types/domain";

export interface LastExport {
  sessionId: string;
  subjectName: string;
  savedTo: string | null;  // e.g. data/sessions/2026-11-14_12-03_kacper_ses_xxx, null if not saved
  zipDownloaded: boolean;
  datasetRows: number;
  atMs: number;
}

interface SessionState {
  session: SessionInfo | null;
  lastRecording: RecordingMeta | null;
  recordingOriginMs: number | null;  // start of the first recording segment, zero of t_rel_ms for the whole session
  segmentCount: number;
  lastExport: LastExport | null;
  baselineDoneFor: string | null;  // session that already did the fixation cross
  setBaselineDone: (sessionId: string) => void;
  setLastExport: (e: LastExport | null) => void;
  setSession: (session: SessionInfo | null) => void;
  registerSegmentStart: (startedAtMs: number) => void;
  setLastRecording: (meta: RecordingMeta | null) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      session: null,
      lastRecording: null,
      recordingOriginMs: null,
      segmentCount: 0,
      lastExport: null,
      baselineDoneFor: null,
      setBaselineDone: (baselineDoneFor) => set({ baselineDoneFor }),
      setLastExport: (lastExport) => set({ lastExport }),
      setSession: (session) => set({ session, recordingOriginMs: null, segmentCount: 0 }),
      registerSegmentStart: (startedAtMs) =>
        set((s) => ({ recordingOriginMs: s.recordingOriginMs ?? startedAtMs, segmentCount: s.segmentCount + 1 })),
      setLastRecording: (lastRecording) => set({ lastRecording }),
    }),
    { name: "brainloop.session" },
  ),
);

export const selectIsActive = (s: SessionState) => !!s.session && s.session.endedAtMs === null;
