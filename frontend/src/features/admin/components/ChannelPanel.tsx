import { Activity, Move3d } from "lucide-react";
import { Badge, Card, CardTitle } from "@/components/ui";
import { CHANNEL_COLORS, QUALITY_META, channelQuality, formatUv } from "@/lib/eeg";
import { ELECTRODES, type BrainSnapshot } from "@/types/domain";
import { useSnapshotHistory } from "../useSnapshotHistory";
import { MiniTrace } from "./MiniTrace";

const AXES = [
  { key: "x", label: "Accel_x", color: "#b54a4a" },
  { key: "y", label: "Accel_y", color: "#3fa85f" },
  { key: "z", label: "Accel_z", color: "#3f5fb0" },
] as const;

/** Headset channels as in the BrainAccess app: color, PTP in µV, contact quality, preview + accelerometer. */
export function ChannelPanel({ data }: { data: BrainSnapshot | undefined }) {
  const history = useSnapshotHistory(data);
  const good = ELECTRODES.filter((e) => channelQuality(data, e) === "good").length;

  return (
    <Card className="md:col-span-2 lg:col-span-3">
      <CardTitle
        icon={<Activity className="size-3.5" />}
        right={<Badge tone={good === 8 ? "ok" : good >= 5 ? "warn" : "danger"}>{good}/8 channels OK</Badge>}
      >
        Headset channels · BrainAccess
      </CardTitle>

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
              <p className="mt-1 font-mono text-[11px] text-muted">PTP {formatUv(ptp)}</p>
              <MiniTrace values={history.map((h) => (channelQuality(h, e) === "good" ? h.channels[e] : 0))} color={CHANNEL_COLORS[e]} min={0} max={1} />
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
    </Card>
  );
}
