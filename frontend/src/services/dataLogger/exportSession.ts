/**
 * Builds the session's CSV files (session, recordings, events, reel_views, scroll, face, ml_windows)
 * and the optional ZIP bundle (CSVs + video segments). Used by the session lifecycle and Settings.
 */
import { strToU8, zipSync, type Zippable } from "fflate";
import { TRACKING } from "@/config/tracking";
import { objectsToCsv } from "@/lib/csv";
import { recordingFileName } from "@/lib/files";
import { useCsvLogStore } from "@/store/csvLogStore";
import type { StoredSegment } from "@/services/storage/videoStore";
import type { RecordingSegmentRow, SessionInfo, SessionRow } from "@/types/domain";
import { ALL_TABLES, faceTable } from "./tables";

const SESSION_COLUMNS = [
  "session_id", "subject_name", "camera_enabled", "session_start_ms", "session_end_ms",
  "recording_start_ms", "recording_end_ms", "recording_duration_ms", "recording_segments", "recording_file", "video_mime",
  "face_sample_hz", "face_rows", "user_agent", "screen_w", "screen_h",
] as const satisfies readonly (keyof SessionRow)[];

const RECORDING_COLUMNS = [
  "session_id", "segment", "recording_start_ms", "recording_end_ms", "duration_ms", "offset_from_origin_ms",
  "interrupted", "file", "mime", "size_bytes",
] as const satisfies readonly (keyof RecordingSegmentRow)[];

/** recordings.csv rows from segments stored in IndexedDB. */
export function buildRecordingRows(sessionId: string, segments: StoredSegment[]): RecordingSegmentRow[] {
  const origin = segments[0]?.meta.startedAtMs ?? 0;
  return segments.map((s) => ({
    session_id: sessionId,
    segment: s.meta.segment,
    recording_start_ms: s.meta.startedAtMs,
    recording_end_ms: s.endMs,
    duration_ms: s.endMs - s.meta.startedAtMs,
    offset_from_origin_ms: s.meta.startedAtMs - origin,
    interrupted: s.meta.endedAtMs === null ? 1 : 0,
    file: recordingFileName(sessionId, s.meta.startedAtMs, s.endMs),
    mime: s.meta.mimeType,
    size_bytes: s.blob.size,
  }));
}

/** session.csv - recording start and end in a single row (for aligning camera data). */
export function buildSessionRow(session: SessionInfo, endedAtMs: number, recordings: RecordingSegmentRow[]): SessionRow {
  const first = recordings[0];
  const last = recordings[recordings.length - 1];
  return {
    session_id: session.id,
    subject_name: session.subjectName,
    camera_enabled: session.cameraEnabled ? 1 : 0,
    session_start_ms: session.startedAtMs,
    session_end_ms: endedAtMs,
    recording_start_ms: first?.recording_start_ms ?? "",
    recording_end_ms: last?.recording_end_ms ?? "",
    recording_duration_ms: recordings.reduce((a, r) => a + r.duration_ms, 0) || "",
    recording_segments: recordings.length,
    recording_file: recordings.map((r) => r.file).join("|"),
    video_mime: first?.mime ?? "",
    face_sample_hz: TRACKING.faceSampleHz,
    face_rows: faceTable.count,
    user_agent: navigator.userAgent,
    screen_w: window.screen.width,
    screen_h: window.screen.height,
  };
}

/** All session CSV files: name -> content. */
export function buildSessionCsvFiles(sessionRow: SessionRow, recordings: RecordingSegmentRow[]): { name: string; csv: string }[] {
  const sid = sessionRow.session_id;
  return [
    { name: "session.csv", csv: objectsToCsv(SESSION_COLUMNS, [sessionRow]) },
    { name: "recordings.csv", csv: objectsToCsv(RECORDING_COLUMNS, recordings) },
    { name: "events.csv", csv: useCsvLogStore.getState().toCsv(sid) },
    ...ALL_TABLES.map((t) => ({ name: t.fileName, csv: t.toCsv((r) => (r as { session_id: string }).session_id === sid) })),
  ];
}

/** One ZIP bundle: all CSVs + video files (video is stored uncompressed in the ZIP since it is already compressed). */
export async function buildSessionZip(
  files: { name: string; csv: string }[],
  videos: { blob: Blob; fileName: string }[],
): Promise<Blob> {
  const entries: Zippable = {};
  for (const f of files) entries[f.name] = strToU8(f.csv);
  for (const v of videos) entries[v.fileName] = [new Uint8Array(await v.blob.arrayBuffer()), { level: 0 }];
  const zipped = zipSync(entries, { level: 6 });
  return new Blob([zipped.buffer as ArrayBuffer], { type: "application/zip" });
}
