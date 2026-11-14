import { useRecordingStore } from "@/store/recordingStore";
import { useSessionStore } from "@/store/sessionStore";
import type { Stamp } from "@/types/domain";

/**
 * Common timeline for all tables.
 * t_rel_ms is counted from the start of the FIRST recording segment (or the session, if the camera is off).
 * Segment 0: video second = t_rel_ms / 1000.
 * Later segments: second = (t_rel_ms - offset_from_origin_ms) / 1000 (see recordings.csv).
 */
export function timeOrigin(fallback: number): number {
  const s = useSessionStore.getState();
  return s.recordingOriginMs ?? useRecordingStore.getState().startedAtMs ?? s.session?.startedAtMs ?? fallback;
}

export function stamp(tsMs = Date.now()): Stamp {
  return {
    session_id: useSessionStore.getState().session?.id ?? "",
    ts_ms: tsMs,
    t_rel_ms: tsMs - timeOrigin(tsMs),
  };
}
