/**
 * Admin: EEG fatigue index + theta/alpha/beta band power (relative, 4–30 Hz) + stop alert.
 * Values come from backend/app/eeg/processing.py.
 */
import { AnimatePresence, motion } from "motion/react";
import { Gauge, OctagonAlert, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { BASELINE } from "@/config/tuning";
import { useEegBaseline } from "@/hooks/useEeg";
import { NoEegData } from "./NoEegData";
import { Card, CardTitle } from "@/components/ui";
import type { BrainSnapshot } from "@/types/domain";

const BANDS = [
  { key: "theta", label: "Theta 4–8 Hz", color: "var(--color-warn)" },
  { key: "alpha", label: "Alpha 8–12 Hz", color: "var(--color-neon-violet)" },
  { key: "beta", label: "Beta 13–30 Hz", color: "var(--color-neon-cyan)" },
] as const;

/** "Recalibrate": 30 s resting baseline right now (person relaxed, looking at one point). */
function RecalibrateButton() {
  const { mutate } = useEegBaseline();
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (left === null) return;
    if (left <= 0) {
      mutate("finish");
      setLeft(null);
      return;
    }
    const id = window.setTimeout(() => setLeft(left - 1), 1_000);
    return () => window.clearTimeout(id);
  }, [left, mutate]);
  return (
    <button
      type="button"
      disabled={left !== null}
      onClick={() => mutate("start", { onSuccess: () => setLeft(BASELINE.durationMs / 1000) })}
      title="Collect a new resting baseline (30 s): the person relaxes and looks at one point"
      className="flex cursor-pointer items-center gap-1 rounded-full bg-surface-strong px-2.5 py-1 text-[11px] text-muted transition hover:text-fg disabled:cursor-default"
    >
      <RotateCcw className="size-3" />
      {left === null ? "Recalibrate" : `Relax & look at one point… ${left}s`}
    </button>
  );
}

export function FatiguePanel({ data, live }: { data: BrainSnapshot | undefined; live: boolean }) {
  const score = data?.fatigueScore ?? 0;
  const R = 52;
  const C = 2 * Math.PI * R;
  const color = score > 0.72 ? "var(--color-danger)" : score > 0.45 ? "var(--color-warn)" : "var(--color-ok)";

  return (
    <Card>
      <CardTitle icon={<Gauge className="size-3.5" />} right={live ? <RecalibrateButton /> : undefined}>Fatigue</CardTitle>
      {!live ? (
        <NoEegData />
      ) : (
        <>
      <div className="flex items-center gap-5">
        <div className="relative size-32 shrink-0">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90">
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--surface-strong)" strokeWidth="10" />
            <circle cx="60" cy="60" r={R} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - score)}
              style={{ transition: "stroke-dashoffset 150ms linear, stroke 150ms linear", filter: `drop-shadow(0 0 6px ${color})` }} />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="font-mono text-3xl tabular-nums">{Math.round(score * 100)}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted">index</p>
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-3">
          {BANDS.map((b) => {
            const v = data?.bands[b.key] ?? 0;
            return (
              <div key={b.key}>
                <div className="flex justify-between text-xs"><span className="text-muted">{b.label}</span><span className="font-mono">{v.toFixed(2)}</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-strong">
                  <div className="h-full rounded-full transition-all duration-100" style={{ width: `${v * 100}%`, background: b.color, boxShadow: `0 0 10px ${b.color}` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* The raw input of BRI: current ratio vs this person at rest */}
      <p className="mt-3 font-mono text-[11px] text-muted">
        (θ+α)/β now <span className="text-fg">{data?.ratio == null ? "—" : data.ratio.toFixed(2)}</span>
        {" · at rest "}
        <span className="text-fg">{data?.baselineRatio == null ? "calibrating…" : data.baselineRatio.toFixed(2)}</span>
        {data?.ratio != null && data.baselineRatio != null && (
          <> · <span className="text-fg">{(data.ratio / data.baselineRatio).toFixed(2)}×</span></>
        )}
      </p>
      {/* Fixed height – the alert doesn't "jump" and isn't clipped */}
      <div className="mt-4 h-12">
        <AnimatePresence>
          {data?.shouldStop && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="flex h-full items-center gap-3 rounded-xl border border-danger/40 bg-danger/10 px-3 text-danger"
            >
              <OctagonAlert className="size-5 shrink-0 animate-pulse" />
              <span className="text-sm font-medium">Stop scrolling – take a break</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
        </>
      )}
    </Card>
  );
}
