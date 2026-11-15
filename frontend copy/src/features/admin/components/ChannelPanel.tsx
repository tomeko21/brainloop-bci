// Per-electrode view modelled on the BrainAccess app: PTP, contact, raw trace, accelerometer.
import { Activity, Move3d } from "lucide-react";
import { NoEegData } from "./NoEegData";
import { Badge, Card, CardTitle } from "@/components/ui";
import { CHANNEL_COLORS, QUALITY_META, channelQuality, formatUv } from "@/lib/eeg";
import { ELECTRODES, type BrainSnapshot } from "@/types/domain";
import { useSnapshotHistory } from "../useSnapshotHistory";
import { useWaveBuffer } from "../useWaveBuffer";
import { MiniTrace } from "./MiniTrace";

const AXES = [
  { key: "x", label: "Accel_x", color: "#b54a4a" },
  { key: "y", label: "Accel_y", color: "#3fa85f" },
  { key: "z", label: "Accel_z", color: "#3f5fb0" },
] as const;

// ±100 µV, widened for bigger signals so artifacts aren't clipped
function traceRange(v: number[]) {
  let m = 100;
  for (const x of v) m = Math.max(m, Math.abs(x));
  return { min: -m, max: m };
}

export function ChannelPanel({ data, live }: { data: BrainSnapshot | undefined; live: boolean }) {
  const history = useSnapshotHistory(data, 100); // ~10 s at 10 snapshots/s
  const waves = useWaveBuffer(data, 4);
  const good = ELECTRODES.filter((e) => channelQuality(data, e) === "good").length;

  return (
    <Card className="md:col-span-2 lg:col-span-3">
      <CardTitle
        icon={<Activity className="size-3.5" />}
        right={<Badge tone={good === 8 ? "ok" : good >= 5 ? "warn" : "danger"}>{good}/8 channels OK</Badge>}
      >
        Headset channels · BrainAccess
      </CardTitle>
      {!live ? (
        <NoEegData />
      ) : (
        <>

      {data?.saturated === ELECTRODES.length && (
        <p className="mb-3 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
          All channels are saturated (amplifier at its limit) – the reference/bias electrode (ear clip) is not touching
          the skin. Fix it and the channels turn green.
        </p>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {ELECTRODES.map((e) => {
          const q = channelQuality(data, e);
          const ptp = data?.ptpUv?.[e] ?? NaN;
          return (
            <div key={e} className="rounded-xl bg-surface p-3" title={QUALITY_META[q].label}>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-sm" style={{ background: CHANNEL_COLORS[e] }} />
                <span className="font-mono text-sm font-medium">{e}</span>
                <span className="ml-auto flex items-center gap-1.5 text-[10px] text-muted">
                  {QUALITY_META[q].label}
                  <span className="relative flex size-2.5">
                    {q !== "good" && <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: QUALITY_META[q].color }} />}
                    <span className="relative size-2.5 rounded-full" style={{ background: QUALITY_META[q].color }} />
                  </span>
                </span>
              </div>
              <p className="mt-1 flex justify-between font-mono text-[11px] text-muted">
                <span>PTP {formatUv(ptp)}</span>
                {data?.artifacts?.includes(e) && <span className="text-warn" title="Blink / spike – left out of BRI for this window">blink</span>}
              </p>
              <MiniTrace values={waves[e]} color={CHANNEL_COLORS[e]} {...traceRange(waves[e])} />
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted">
          <Move3d className="size-3.5" /> Accelerometer (head movement)
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {AXES.map((a) => (
            <div key={a.key} className="rounded-xl bg-surface p-3">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-sm" style={{ background: a.color }} />
                <span className="font-mono text-sm">{a.label}</span>
                <span className="ml-auto font-mono text-xs text-muted">
                  {data?.accel ? `${data.accel[a.key].toFixed(3)} g` : "—"}
                </span>
              </div>
              <MiniTrace values={history.map((h) => h.accel?.[a.key] ?? 0)} color={a.color} />
            </div>
          ))}
        </div>
      </div>
        </>
      )}
    </Card>
  );
}
