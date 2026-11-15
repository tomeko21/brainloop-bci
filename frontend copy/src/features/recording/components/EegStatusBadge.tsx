import { BatteryMedium, Brain, Loader2 } from "lucide-react";
import { useEegStatus } from "@/hooks/useEeg";
import { cn } from "@/lib/cn";
import { EEG_STATE_LABEL } from "@/lib/eeg";
import type { EegStatusOutput } from "@/types/api/output/useEeg";


function tone(s: EegStatusOutput | undefined, isError: boolean): "ok" | "warn" | "danger" | "muted" {
  if (isError) return "danger";
  if (!s || s.state === "waiting") return "muted";
  if (s.state === "streaming") return "ok";
  return "warn";
}

const TONE = {
  ok: "border-ok/30 bg-ok/10 text-ok",
  warn: "border-warn/30 bg-warn/10 text-warn",
  danger: "border-danger/30 bg-danger/10 text-danger",
  muted: "border-border bg-surface text-muted",
};

// the headset itself is connected in BrainAccess Board
export function EegStatusBadge({ className }: { className?: string }) {
  const { data: s, isError } = useEegStatus();
  const busy = s?.state === "connected";
  const label = isError ? "backend offline" : !s ? "…" : s.state === "streaming" && s.device ? s.device : EEG_STATE_LABEL[s.state] ?? s.state;

  return (
    <div className={cn("flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs", TONE[tone(s, isError)], className)}>
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Brain className="size-3.5" />}
      <span className="font-medium">EEG</span>
      <span className="truncate">{label}</span>
      {s?.state === "streaming" && s.battery != null && (
        <span className="ml-auto flex items-center gap-1 font-mono">
          <BatteryMedium className="size-3.5" /> {s.battery}%
        </span>
      )}
    </div>
  );
}
