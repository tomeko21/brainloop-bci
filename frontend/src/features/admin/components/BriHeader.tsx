// Live Brain Rot Index from the EEG + camera model. Data comes from useBrainrotStore (services/brainrot/brainrotClient.ts, /ws/brainrot).
import { Brain, Camera, Crosshair } from "lucide-react";
import { useEffect } from "react";
import { Badge, Card } from "@/components/ui";
import { useNow } from "@/lib/useNow";
import { ensureBrainrotConnection } from "@/services/brainrot/brainrotClient";
import { useBrainrotStore } from "@/store/brainrotStore";
import type { EegStreamOutput } from "@/types/api/output/useEeg";

const briColor = (v: number) => (v >= 70 ? "var(--color-danger)" : v >= 40 ? "var(--color-warn)" : "var(--color-ok)");
const briLabel = (v: number) => (v >= 70 ? "brainrot – take a break!" : v >= 40 ? "drifting" : "focused");

function Gauge({ value, faded }: { value: number | null; faded: boolean }) {
  const v = value ?? 0;
  const C = Math.PI * 46; // length of the r=46 semicircle
  return (
    <div className="relative h-36 w-64" style={{ opacity: faded ? 0.5 : 1 }}>
      <svg viewBox="0 0 120 66" className="size-full">
        <path d="M14 60 A46 46 0 0 1 106 60" fill="none" stroke="var(--surface-strong)" strokeWidth="10" strokeLinecap="round" />
        <path d="M14 60 A46 46 0 0 1 106 60" fill="none" stroke={value === null ? "transparent" : briColor(v)} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - v / 100)}
          style={{ transition: "stroke-dashoffset 450ms linear, stroke 450ms linear", filter: `drop-shadow(0 0 6px ${briColor(v)})` }} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="font-mono text-6xl font-medium tabular-nums">{value === null ? "—" : Math.round(v)}</p>
      </div>
    </div>
  );
}

function Trend({ hist }: { hist: { t: number; bri: number | null }[] }) {
  const w = 300, h = 90;
  if (hist.length < 2) return <div className="h-28 w-full" />;
  const t0 = hist[0].t, t1 = hist[hist.length - 1].t;
  const x = (t: number) => (((t - t0) / Math.max(1, t1 - t0)) * w).toFixed(1);
  const y = (v: number) => (h - (v / 100) * h).toFixed(1);
  // gaps where there is no value (fixation cross, no data)
  const parts: string[] = [];
  let cur: string[] = [];
  for (const p of hist) {
    if (p.bri === null) {
      if (cur.length) parts.push(cur.join(" "));
      cur = [];
    } else cur.push(`${x(p.t)},${y(p.bri)}`);
  }
  if (cur.length) parts.push(cur.join(" "));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-28 w-full">
      <line x1="0" x2={w} y1={y(25)} y2={y(25)} stroke="var(--border)" strokeDasharray="3 3" />
      <line x1="0" x2={w} y1={y(70)} y2={y(70)} stroke="var(--color-danger)" strokeOpacity="0.5" strokeDasharray="4 4" />
      {parts.map((pts, i) => (
        <polyline key={i} points={pts} fill="none" stroke="var(--color-neon-pink)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

export function BriHeader({ live }: { eeg?: EegStreamOutput; live: boolean }) {
  useEffect(() => ensureBrainrotConnection(), []);
  const state = useBrainrotStore((s) => s.state);
  const hist = useBrainrotStore((s) => s.history);
  const status = useBrainrotStore((s) => s.status);

  const now = useNow(1_000);
  const fresh = !!state && now - state.tMs < 5_000;
  const bri = fresh && state?.enabled ? state.bri : null;
  const mode = state?.baselineMode;
  const src = state?.sources;

  const subtitle = !state
    ? status === "open" ? "waiting for the backend…" : "connecting to the backend…"
    : !state.enabled
      ? `live model not loaded – run data_acc/export_live.py (${state.error ?? ""})`
      : mode === "collecting"
        ? `Baseline: look at the cross… ${Math.round(state.baselineElapsedS ?? 0)} s (first 15 s skipped)`
        : !src?.eeg && !src?.face
          ? "no usable data – camera on? electrodes green?"
          : state.stale
            ? "holding the last value – no fresh data"
            : briLabel(bri ?? 0);

  return (
    <Card glow className="md:col-span-2 lg:col-span-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">
          BRI <span className="text-neon">BrainRot Index</span>
        </h2>
        <span className="text-xs text-muted">25 = you at rest · 70 = take a break · EEG + camera, one model</span>
      </div>
      <div className="flex flex-col items-stretch gap-4 lg:flex-row">
        <div className="flex flex-col items-center rounded-2xl bg-surface p-4 lg:w-80">
          <Gauge value={bri} faded={!!state?.stale} />
          <p className="mt-1 text-sm font-medium" style={{ color: bri === null ? undefined : briColor(bri) }}>{subtitle}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            <Badge tone={mode === "personal" ? "ok" : mode === "collecting" ? "warn" : undefined}>
              <Crosshair className="mr-1 inline size-3" />
              {mode === "personal" ? "own baseline" : mode === "collecting" ? "baseline…" : "default baseline"}
            </Badge>
            <Badge tone={src?.eeg ? "cyan" : undefined}>
              <Brain className="mr-1 inline size-3" />
              EEG {src?.eeg ? `✓ ${state?.eegGoodChannels ?? 0} ch` : live ? "noisy" : "off"}
            </Badge>
            <Badge tone={src?.face ? "violet" : undefined}>
              <Camera className="mr-1 inline size-3" />
              camera {src?.face ? "✓" : src?.faceConnected ? "no face" : "off"}
            </Badge>
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-between rounded-2xl bg-surface p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-[0.15em] text-muted">Last 3 minutes</span>
            {state?.briRaw != null && <span className="font-mono text-muted">raw {Math.round(state.briRaw)}</span>}
          </div>
          <Trend hist={hist} />
          <div className="flex justify-between text-[11px] text-muted">
            <span>{state?.model ?? ""}</span>
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-border" />rest 25</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-danger/60" />break 70</span>
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
