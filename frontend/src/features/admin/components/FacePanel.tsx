import { ScanFace } from "lucide-react";
import { Badge, Card, CardTitle } from "@/components/ui";
import { useLiveViewer } from "@/hooks/useAdmin";
import type { FaceLiveSummary } from "@/types/domain";

/** Values may be null (NaN in the browser is sent as null). */
const fmt = (v: number | null | undefined, d = 2) => (v != null && Number.isFinite(v) ? v.toFixed(d) : "—");
const gt = (v: number | null | undefined, t: number) => v != null && v > t;
const lt = (v: number | null | undefined, t: number) => v != null && v < t;

function Metric({ label, value, unit, warn }: { label: string; value: string; unit?: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-surface p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className={warn ? "font-mono text-lg text-warn" : "font-mono text-lg"}>
        {value}
        {unit && <span className="ml-0.5 text-xs text-muted">{unit}</span>}
      </p>
    </div>
  );
}

/** Face features (MediaPipe) from the user's device – delivered in the heartbeat. */
export function FacePanel() {
  const { data } = useLiveViewer();
  const f: FaceLiveSummary | null = data?.status !== "offline" ? (data?.face ?? null) : null;
  const video = data?.status !== "offline" ? (data?.video ?? null) : null;

  return (
    <Card>
      <CardTitle
        icon={<ScanFace className="size-3.5" />}
        right={f ? (f.present ? <Badge tone="ok" dot>face</Badge> : <Badge tone="warn">no face</Badge>) : <Badge>camera off</Badge>}
      >
        Camera · MediaPipe
      </CardTitle>
      {f ? (
        <div className="grid grid-cols-3 gap-2">
          <Metric label="EAR" value={fmt(f.earAvg)} warn={lt(f.earAvg, 0.2)} />
          <Metric label="Blinks" value={fmt(f.blinkRatePerMin, 0)} unit="/min" />
          <Metric label="PERCLOS" value={fmt(f.perclos != null ? f.perclos * 100 : null, 0)} unit="%" warn={gt(f.perclos, 0.15)} />
          <Metric label="Pitch" value={fmt(f.pitchDeg, 0)} unit="°" />
          <Metric label="Yaw" value={fmt(f.yawDeg, 0)} unit="°" />
          <Metric label="Yawning" value={fmt(f.jawOpen)} warn={gt(f.jawOpen, 0.5)} />
          <p className="col-span-3 font-mono text-[10px] text-muted">
            {fmt(f.fps, 1)} Hz · inference {fmt(f.inferenceMs, 1)} ms
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted">No camera data – the user is not recording or is offline.</p>
      )}

      {/* Independent analysis of the frames uploaded to the backend (OpenCV) */}
      {video && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-muted">Server · camera frames (OpenCV)</p>
          <div className="grid grid-cols-3 gap-2">
            <Metric label="Face" value={fmt(video.facePresentRatio * 100, 0)} unit="%" warn={video.facePresentRatio < 0.5} />
            <Metric label="Motion" value={fmt(video.motion, 1)} warn={video.motion < 1} />
            <Metric label="Light" value={fmt(video.brightness, 0)} warn={video.brightness < 50} />
          </div>
          <p className="mt-1 font-mono text-[10px] text-muted">
            {video.frames} frames / batch · face area {fmt(video.faceArea != null ? video.faceArea * 100 : null, 1)}%
          </p>
        </div>
      )}
    </Card>
  );
}
