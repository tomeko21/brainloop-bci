// Recording kept in IndexedDB as 1 s chunks. A refresh stops the camera, but what was recorded stays as a segment
// and resuming starts the next one.
import { STORES, idbDeleteBySession, idbGetAllBySession, idbPut } from "./idb";

export interface SegmentMeta {
  sessionId: string;
  segment: number;
  mimeType: string;
  startedAtMs: number;
  endedAtMs: number | null;  // null = interrupted, end comes from the last chunk
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
  endMs: number;
  blob: Blob;
}

export const saveSegmentMeta = (meta: SegmentMeta) => idbPut(STORES.segments, meta);

export const appendVideoChunk = (sessionId: string, segment: number, data: Blob, tsMs: number) =>
  idbPut<VideoChunk>(STORES.videoChunks, { sessionId, segment, tsMs, data });

export async function countSegments(sessionId: string): Promise<number> {
  return (await idbGetAllBySession<SegmentMeta>(STORES.segments, sessionId)).length;
}

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
