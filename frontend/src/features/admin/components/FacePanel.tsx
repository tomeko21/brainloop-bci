import { ScanFace } from "lucide-react";
import { Badge, Card, CardTitle } from "@/components/ui";
import { useLiveViewer } from "@/hooks/useAdmin";
import type { FaceLiveSummary } from "@/types/domain";

const fmt = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "—");

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
          <Metric label="EAR" value={fmt(f.earAvg)} warn={f.earAvg < 0.2} />
          <Metric label="Blinks" value={fmt(f.blinkRatePerMin, 0)} unit="/min" />
          <Metric label="PERCLOS" value={fmt(f.perclos * 100, 0)} unit="%" warn={f.perclos > 0.15} />
          <Metric label="Pitch" value={fmt(f.pitchDeg, 0)} unit="°" />
          <Metric label="Yaw" value={fmt(f.yawDeg, 0)} unit="°" />
          <Metric label="Yawning" value={fmt(f.jawOpen)} warn={f.jawOpen > 0.5} />
          <p className="col-span-3 font-mono text-[10px] text-muted">
            {fmt(f.fps, 1)} Hz · inference {fmt(f.inferenceMs, 1)} ms
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted">No camera data – the user is not recording or is offline.</p>
      )}
    </Card>
  );
}
