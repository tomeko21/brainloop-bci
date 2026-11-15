import { useRecordingStore } from "@/store/recordingStore";
import { useSessionStore } from "@/store/sessionStore";
import type { Stamp } from "@/types/domain";

// Shared zero for all tables: start of the first recording segment, or the session start with the camera off.
// Later segments are offset by offset_from_origin_ms in recordings.csv.
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
