/**
 * Recording saved continuously to IndexedDB (1 s chunks from MediaRecorder).
 * A page refresh interrupts recording (the camera turns off), but what has already been recorded
 * stays as a "segment". After resuming, the next segment starts.
 */
import { STORES, idbDeleteBySession, idbGetAllBySession, idbPut } from "./idb";

export interface SegmentMeta {
  sessionId: string;
  segment: number;
  mimeType: string;
  startedAtMs: number;
  /** null = segment interrupted (e.g. reload) - end = time of the last saved chunk */
  endedAtMs: number | null;
}

interface VideoChunk {
  id?: number;
  sessionId: string;
  segment: number;
  tsMs: number;
  data: Blob;
}

export interface StoredSegment {
  meta: SegmentMeta;
  /** Segment end: endedAtMs or the time of the last saved chunk. */
  endMs: number;
  blob: Blob;
}

export const saveSegmentMeta = (meta: SegmentMeta) => idbPut(STORES.segments, meta);

export const appendVideoChunk = (sessionId: string, segment: number, data: Blob, tsMs: number) =>
  idbPut<VideoChunk>(STORES.videoChunks, { sessionId, segment, tsMs, data });

export async function countSegments(sessionId: string): Promise<number> {
  return (await idbGetAllBySession<SegmentMeta>(STORES.segments, sessionId)).length;
}

/** All session segments assembled into video files. */
export async function loadSegments(sessionId: string): Promise<StoredSegment[]> {
  const [metas, chunks] = await Promise.all([
    idbGetAllBySession<SegmentMeta>(STORES.segments, sessionId),
    idbGetAllBySession<VideoChunk>(STORES.videoChunks, sessionId),
  ]);
  chunks.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  return metas
    .sort((a, b) => a.segment - b.segment)
    .map((meta) => {
      const mine = chunks.filter((c) => c.segment === meta.segment);
      const lastChunkAt = mine.length ? mine[mine.length - 1].tsMs : meta.startedAtMs;
      return { meta, endMs: meta.endedAtMs ?? lastChunkAt, blob: new Blob(mine.map((c) => c.data), { type: meta.mimeType }) };
    })
    .filter((s) => s.blob.size > 0);
}

export async function deleteSessionVideo(sessionId: string): Promise<void> {
  await Promise.all([idbDeleteBySession(STORES.videoChunks, sessionId), idbDeleteBySession(STORES.segments, sessionId)]);
}
