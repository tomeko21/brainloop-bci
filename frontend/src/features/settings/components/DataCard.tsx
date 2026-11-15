// Settings card: data location, table row counts, EEG/MediaPipe status and manual exports.
import { Database, Download, FileVideo, FolderOpen, HardDriveDownload, Package, ScanFace, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardTitle, Switch } from "@/components/ui";
import { EegConnectPanel } from "@/features/recording/components/EegConnectPanel";
import { useStorageStatus } from "@/hooks/useSession";
import { useSettingsStore } from "@/store/settingsStore";
import { getLastRecordingBlob } from "@/features/session/useSessionLifecycle";
import { useCsvLogStore } from "@/store/csvLogStore";
import { useSessionStore } from "@/store/sessionStore";
import { usePersistenceStore } from "@/store/persistenceStore";
import { flushTables } from "@/services/storage/tableAutosave";
import { loadSegments } from "@/services/storage/videoStore";
import { useFaceStore } from "@/store/faceStore";
import { faceTable, mlWindowsTable, reelViewsTable, scrollTable } from "@/services/dataLogger/tables";
import { useTableCount } from "@/services/dataLogger/useTableCount";
import { buildRecordingRows, buildSessionCsvFiles, buildSessionRow, buildSessionZip } from "@/services/dataLogger/exportSession";
import { csvFileName, downloadBlob, downloadText } from "@/lib/files";
import { formatBytes, formatTime } from "@/lib/format";

const FACE_STATUS = {
  off: <Badge>off</Badge>,
  loading: <Badge tone="warn">loading model</Badge>,
  running: <Badge tone="ok" dot>running</Badge>,
  error: <Badge tone="danger">error</Badge>,
};

export function DataCard() {
  const rows = useCsvLogStore((s) => s.rows);
  const toCsv = useCsvLogStore((s) => s.toCsv);
  const clear = useCsvLogStore((s) => s.clear);
  const session = useSessionStore((s) => s.session);
  const last = useSessionStore((s) => s.lastRecording);
  const faceStatus = useFaceStore((s) => s.status);
  const faceError = useFaceStore((s) => s.error);
  const blob = getLastRecordingBlob();
  const persist = usePersistenceStore();
  const storage = useStorageStatus();
  const autoZip = useSettingsStore((s) => s.autoDownloadZip);
  const setAutoZip = useSettingsStore((s) => s.setAutoDownloadZip);

  const counts = [
    { name: "events.csv", n: rows.filter((r) => r.sessionId === session?.id).length },
    { name: "reel_views.csv", n: useTableCount(reelViewsTable) },
    { name: "scroll.csv", n: useTableCount(scrollTable) },
    { name: "face.csv", n: useTableCount(faceTable) },
    { name: "ml_windows.csv", n: useTableCount(mlWindowsTable) },
  ];

  // bundle the session so far without ending it
  const exportSnapshot = async () => {
    if (!session) return;
    const now = Date.now();
    await flushTables();
    const segments = await loadSegments(session.id);
    const recordings = buildRecordingRows(session.id, segments);
    const files = buildSessionCsvFiles(buildSessionRow(session, now, recordings), recordings);
    const videos = segments.map((s, i) => ({ blob: s.blob, fileName: recordings[i].file }));
    downloadBlob(await buildSessionZip(files, videos), `brainloop_${session.id}_snapshot_${now}.zip`);
  };

  return (
    <Card>
      <CardTitle icon={<Database className="size-3.5" />}>Model data</CardTitle>
      <div className="mb-3 rounded-xl bg-surface p-2.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-muted"><FolderOpen className="size-3.5" />Save after session</span>
          {storage.data?.mode === "local" ? <Badge tone="ok">folder data/</Badge> : storage.data?.mode === "backend" ? <Badge tone="cyan">backend</Badge> : <Badge tone="warn">ZIP only</Badge>}
        </div>
        {storage.data?.location && <p className="mt-1 break-all font-mono text-[10px] text-muted">{storage.data.location}</p>}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-muted">Also download ZIP</span>
          <Switch checked={autoZip} onChange={setAutoZip} label="Also download ZIP" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {counts.map((c) => (
          <div key={c.name} className="rounded-xl bg-surface p-2.5">
            <p className="truncate font-mono text-[10px] text-muted">{c.name}</p>
            <p className="font-mono text-xl tabular-nums">{c.n}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-surface p-2.5 text-xs">
        <span className="flex items-center gap-1.5 text-muted"><ScanFace className="size-3.5" />MediaPipe</span>
        {FACE_STATUS[faceStatus]}
      </div>
      {faceError && <p className="mt-1 text-xs text-danger">{faceError}</p>}

      <EegConnectPanel className="mt-2" />

      <div className="mt-2 rounded-xl bg-surface p-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-muted"><HardDriveDownload className="size-3.5" />Autosave (IndexedDB)</span>
          {persist.error ? (
            <Badge tone="danger">error</Badge>
          ) : persist.lastSavedAtMs ? (
            <span className="font-mono">{formatTime(persist.lastSavedAtMs)}</span>
          ) : (
            <Badge>waiting</Badge>
          )}
        </div>
        {(persist.restoredRows > 0 || persist.restoredSegments > 0) && (
          <p className="mt-1 text-ok">
            Restored after refresh: {persist.restoredRows} rows, {persist.restoredSegments} video segments
          </p>
        )}
        {persist.error && <p className="mt-1 text-danger">{persist.error}</p>}
      </div>

      {last && (
        <div className="mt-3 rounded-xl bg-surface p-3 text-sm">
          <p className="flex items-center gap-1.5 text-xs text-muted"><FileVideo className="size-3" />Last recording</p>
          <p className="mt-1 truncate font-mono text-xs">{last.fileName}</p>
          <p className="mt-1 text-xs text-muted">
            {formatTime(last.startedAtMs)} → {formatTime(last.endedAtMs)} · {formatBytes(last.sizeBytes)}
          </p>
        </div>
      )}
      <div className="mt-4 grid gap-2">
        <Button variant="secondary" onClick={() => void exportSnapshot()} disabled={!session}>
          <Package className="size-4" /> ZIP bundle (CSV + video so far)
        </Button>
        <Button variant="ghost" size="sm" onClick={() => downloadText(toCsv(), csvFileName(null))} disabled={!rows.length}>
          <Download className="size-3.5" /> events.csv – all sessions
        </Button>
        {last && blob && (
          <Button variant="ghost" size="sm" onClick={() => downloadBlob(blob, last.fileName)}>
            <FileVideo className="size-3.5" /> Download last recording
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => confirm("Clear the global event log?") && clear()} disabled={!rows.length}>
          <Trash2 className="size-3.5" /> Clear event log
        </Button>
      </div>
    </Card>
  );
}
