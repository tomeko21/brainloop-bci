import { motion } from "motion/react";
import { Brain, Cpu, GitCompareArrows } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Badge, Card } from "@/components/ui";
import { useLiveViewer } from "@/hooks/useAdmin";
import type { EegStreamOutput } from "@/types/api/output/useEeg";

const briColor = (v: number) => (v >= 70 ? "var(--color-danger)" : v >= 40 ? "var(--color-warn)" : "var(--color-ok)");
const briLabel = (v: number) => (v >= 70 ? "brainrot – take a break!" : v >= 40 ? "drifting" : "focused");

const FACTOR_PL: Record<string, string> = {
  perclos: "PERCLOS", blink_rate_high: "frequent blinking", blink_rate_low: "infrequent blinking", eyes_narrow: "narrowed eyes",
  head_down: "head drooping", head_frozen: "frozen", yawn: "yawning", fast_scroll: "fast scroll",
  short_dwell: "short watch time", low_watch_pct: "low watch %",
};

function Gauge({ title, icon, value, source, subtitle, children }: {
  title: string; icon: React.ReactNode; value: number | null; source: React.ReactNode; subtitle: string; children?: React.ReactNode;
}) {
  const v = value ?? 0;
  const R = 46;
  const C = Math.PI * R; // semicircle
  return (
    <div className="flex flex-1 flex-col items-center rounded-2xl bg-surface p-4">
      <div className="flex w-full items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-muted">{icon}{title}</span>
        {source}
      </div>
      <div className="relative mt-2 h-24 w-48">
        <svg viewBox="0 0 120 66" className="size-full">
          <path d="M14 60 A46 46 0 0 1 106 60" fill="none" stroke="var(--surface-strong)" strokeWidth="10" strokeLinecap="round" />
          <path d="M14 60 A46 46 0 0 1 106 60" fill="none" stroke={value === null ? "transparent" : briColor(v)} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - v / 100)}
            style={{ transition: "stroke-dashoffset 500ms ease, stroke 500ms ease", filter: `drop-shadow(0 0 6px ${briColor(v)})` }} />
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <p className="font-mono text-4xl font-medium tabular-nums">{value === null ? "—" : Math.round(v)}</p>
        </div>
      </div>
      <p className="mt-1 text-sm font-medium" style={{ color: value === null ? undefined : briColor(v) }}>
        {value === null ? "no data" : briLabel(v)}
      </p>
      <p className="text-center text-[11px] text-muted">{subtitle}</p>
      {children}
    </div>
  );
}

/** History of both BRIs (1 point/s) for comparison on one chart. */
function useBriHistory(eeg: number | null, ai: number | null, size = 90) {
  const [hist, setHist] = useState<{ eeg: number | null; ai: number | null }[]>([]);
  const latest = useRef({ eeg, ai });
  useLayoutEffect(() => {
    latest.current = { eeg, ai };
  }, [eeg, ai]);
  useEffect(() => {
    const id = window.setInterval(() => setHist((h) => [...h.slice(-(size - 1)), latest.current]), 1_000);
    return () => window.clearInterval(id);
  }, [size]);
  return hist;
}

function DualTrend({ hist }: { hist: { eeg: number | null; ai: number | null }[] }) {
  const w = 300, h = 80;
  const line = (key: "eeg" | "ai") =>
    hist
      .map((p, i) => (p[key] === null ? null : `${((i / Math.max(1, hist.length - 1)) * w).toFixed(1)},${(h - (p[key]! / 100) * h).toFixed(1)}`))
      .filter(Boolean)
      .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-24 w-full">
      {[30, 60].map((y) => <line key={y} x1="0" x2={w} y1={h - (y / 100) * h} y2={h - (y / 100) * h} stroke="var(--border)" strokeDasharray="3 3" />)}
      <line x1="0" x2={w} y1={h - 0.7 * h} y2={h - 0.7 * h} stroke="var(--color-danger)" strokeOpacity="0.5" strokeDasharray="4 4" />
      <polyline points={line("eeg")} fill="none" stroke="var(--color-neon-cyan)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <polyline points={line("ai")} fill="none" stroke="var(--color-neon-pink)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * BRI – BrainRot Index (0..100) from two sources:
 *  - EEG: backend computes it from headset electrodes (teacher),
 *  - AI: model on camera + scroll, works WITHOUT a headset (student).
 * Agreement of both = proof for the jury that the model "sees" the same as the EEG.
 */
export function BriHeader({ eeg }: { eeg: EegStreamOutput }) {
  const { data: viewer } = useLiveViewer();
  const briEeg = eeg.data?.bri ?? null;
  const pred = viewer?.status !== "offline" ? (viewer?.prediction ?? null) : null;
  const briAi = pred?.bri ?? null;
  const hist = useBriHistory(briEeg, briAi);
  const diff = briEeg !== null && briAi !== null ? Math.abs(briEeg - briAi) : null;

  return (
    <Card glow className="md:col-span-2 lg:col-span-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">
          BRI <span className="text-neon">BrainRot Index</span>
        </h2>
        <span className="text-xs text-muted">0 = fully focused · 100 = total brainrot · break threshold 70</span>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row">
        <Gauge
          title="BRI · EEG"
          icon={<Brain className="size-3.5" />}
          value={briEeg}
          subtitle="from headset electrodes (backend)"
          source={<Badge tone={eeg.transport === "mock" ? "warn" : "cyan"} dot={eeg.status === "open"}>{eeg.transport}</Badge>}
        />

        <div className="flex flex-[1.3] flex-col justify-between rounded-2xl bg-surface p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-semibold uppercase tracking-[0.15em] text-muted">
              <GitCompareArrows className="size-3.5" /> Agreement
            </span>
            {diff === null ? (
              <Badge>waiting for both sources</Badge>
            ) : (
              <motion.span key={diff < 10 ? "ok" : "bad"} initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                <Badge tone={diff < 10 ? "ok" : diff < 25 ? "warn" : "danger"}>Δ {Math.round(diff)} pts</Badge>
              </motion.span>
            )}
          </div>
          <DualTrend hist={hist} />
          <div className="flex justify-center gap-4 text-[11px] text-muted">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-neon-cyan" />EEG</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-neon-pink" />AI</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-danger/60" />threshold 70</span>
          </div>
        </div>

        <Gauge
          title="BRI · AI prediction"
          icon={<Cpu className="size-3.5" />}
          value={briAi}
          subtitle={pred ? `camera + scroll · ${pred.modelVersion}` : "camera + scroll (no headset)"}
          source={<Badge tone={pred?.modelVersion.startsWith("mock") ? "warn" : "violet"}>{pred?.modelVersion.startsWith("mock") ? "mock" : "model"}</Badge>}
        >
          {pred && pred.topFactors.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-1">
              {pred.topFactors.map((f) => (
                <span key={f.feature} className="rounded-full bg-surface-strong px-2 py-0.5 font-mono text-[10px]">
                  {FACTOR_PL[f.feature] ?? f.feature} {f.contribution > 0 ? "+" : ""}{f.contribution}
                </span>
              ))}
            </div>
          )}
        </Gauge>
      </div>
    </Card>
  );
}
