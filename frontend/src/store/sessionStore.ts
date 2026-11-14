import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RecordingMeta, SessionInfo } from "@/types/domain";

/** Save result of the last finished session (shown on the start screen). */
export interface LastExport {
  sessionId: string;
  subjectName: string;
  /** np. data/sessions/2026-11-14_12-03_kacper_ses_xxx – null when saving to data/ is unavailable */
  savedTo: string | null;
  zipDownloaded: boolean;
  datasetRows: number;
  atMs: number;
}

interface SessionState {
  session: SessionInfo | null;
  /** Metadata of the last finished recording (with timestamps). */
  lastRecording: RecordingMeta | null;
  /**
   * Start of the FIRST recording segment – the shared zero of the timeline (t_rel_ms) for the whole session,
   * also after the recording is resumed following a page refresh.
   */
  recordingOriginMs: number | null;
  /** How many recording segments have been started (the next one has number = segmentCount). */
  segmentCount: number;
  lastExport: LastExport | null;
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
