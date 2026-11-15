// Session start/resume/finish. Video segments and CSV tables go to the backend, which writes them to data/.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEndSession, useStartSession, useUploadDataset, useUploadRecording } from "@/hooks/useSession";
import { startRecording, stopRecording } from "@/services/cameraRecorder";
import { startFaceTracking, stopFaceTracking } from "@/services/face/faceTracker";
import { clearSessionTables } from "@/services/dataLogger/tables";
import { buildRecordingRows, buildSessionCsvFiles, buildSessionRow, buildSessionZip } from "@/services/dataLogger/exportSession";
import { deleteSessionTables, flushTables } from "@/services/storage/tableAutosave";
import { deleteSessionVideo, loadSegments } from "@/services/storage/videoStore";
import { useSessionStore } from "@/store/sessionStore";
import { useRecordingStore } from "@/store/recordingStore";
import { logEvent } from "@/store/csvLogStore";
import { downloadBlob } from "@/lib/files";
import { useSettingsStore } from "@/store/settingsStore";
import { ROUTES } from "@/app/routes";

let lastRecordingBlob: Blob | null = null;
export const getLastRecordingBlob = () => lastRecordingBlob;

export async function startCameraSegment(sessionId: string): Promise<void> {
  const segment = useSessionStore.getState().segmentCount;
  const startedAtMs = await startRecording({ sessionId, segment });
  useSessionStore.getState().registerSegmentStart(startedAtMs);
  logEvent("recording_start", { tsMs: startedAtMs, value: `segment=${segment};video_only_no_audio` });
  const stream = useRecordingStore.getState().stream;
  if (stream) void startFaceTracking(stream); // don't block the UI
}

export function useSessionLifecycle() {
  const navigate = useNavigate();
  const startSession = useStartSession();
  const endSession = useEndSession();
  const uploadRecording = useUploadRecording();
  const uploadDataset = useUploadDataset();
  const setSession = useSessionStore((s) => s.setSession);
  const setLastRecording = useSessionStore((s) => s.setLastRecording);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [resuming, setResuming] = useState(false);
  const cameraRequesting = useRecordingStore((s) => s.status === "requesting");

  async function begin({ subjectName, cameraEnabled }: { subjectName: string; cameraEnabled: boolean }) {
    setError(null);
    try {
      const { session } = await startSession.mutateAsync({ subjectName, cameraEnabled });
      clearSessionTables();
      setSession(session);
      logEvent("session_start", { tsMs: session.startedAtMs, value: cameraEnabled ? "camera_on" : "camera_off" });
      if (cameraEnabled) await startCameraSegment(session.id);
      navigate(ROUTES.feed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start session");
    }
  }

  async function resume() {
    const session = useSessionStore.getState().session;
    if (!session) return;
    setResuming(true);
    setError(null);
    try {
      await startCameraSegment(session.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to resume camera");
    } finally {
      setResuming(false);
    }
  }

  // Backend saves to data/sessions/<folder>/ and appends to data/dataset/. ZIP download if enabled or the upload failed.
  async function finish() {
    const session = useSessionStore.getState().session;
    if (!session) return;
    setFinishing(true);
    try {
      stopFaceTracking();
      const finished = await stopRecording();
      if (finished) {
        logEvent("recording_end", {
          tsMs: finished.endedAtMs,
          value: `segment=${finished.segment};duration_ms=${finished.endedAtMs - finished.startedAtMs}`,
        });
      }

      // includes segments recorded before a page refresh
      const segments = await loadSegments(session.id);
      const recordings = buildRecordingRows(session.id, segments);
      for (const [i, seg] of segments.entries()) {
        const { recording } = await uploadRecording.mutateAsync({
          sessionId: session.id,
          blob: seg.blob,
          startedAtMs: seg.meta.startedAtMs,
          endedAtMs: seg.endMs,
        });
        if (i === segments.length - 1) {
          setLastRecording(recording);
          lastRecordingBlob = seg.blob;
        }
      }

      const endedAtMs = Date.now();
      logEvent("session_end", { tsMs: endedAtMs, value: endedAtMs - session.startedAtMs });
      await endSession.mutateAsync({ sessionId: session.id, endedAtMs });

      const files = buildSessionCsvFiles(buildSessionRow(session, endedAtMs, recordings), recordings);
      const saved = await uploadDataset.mutateAsync({ sessionId: session.id, files });

      const download = useSettingsStore.getState().autoDownloadZip || !saved.savedTo;
      if (download) {
        const zip = await buildSessionZip(
          files,
          segments.map((s, i) => ({ blob: s.blob, fileName: recordings[i].file })),
        );
        const folderName = saved.savedTo?.split("/").pop() ?? `brainloop_${session.id}`;
        downloadBlob(zip, `${folderName}.zip`);
      }
      useSessionStore.getState().setLastExport({
        sessionId: session.id,
        subjectName: session.subjectName,
        savedTo: saved.savedTo,
        zipDownloaded: download,
        datasetRows: Object.values(saved.dataset).reduce<number>((a, v) => a + (typeof v === "number" ? v : 0), 0),
        atMs: Date.now(),
      });

      await Promise.all([deleteSessionTables(session.id), deleteSessionVideo(session.id)]);
      clearSessionTables();
      setSession(null);
      navigate(ROUTES.onboarding);
    } catch (e) {
      // keep everything in IndexedDB so finish can be retried
      void flushTables();
      setError(e instanceof Error ? e.message : "Failed to end session");
    } finally {
      setFinishing(false);
    }
  }

  return { begin, resume, finish, error, starting: startSession.isPending || cameraRequesting, finishing, resuming };
}
