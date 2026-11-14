import { Badge } from "@/components/ui";
import type { EegStreamOutput } from "@/types/api/output/useEeg";

const LABEL = { connecting: "connecting", open: "live", reconnecting: "reconnecting", closed: "disconnected" } as const;
const TONE = { connecting: "warn", open: "cyan", reconnecting: "warn", closed: "danger" } as const;

/** EEG stream listener status: transport (SSE/WS/mock), state and frequency. */
export function StreamBadge({ stream }: { stream: EegStreamOutput }) {
  return (
    <Badge tone={TONE[stream.status]} dot={stream.status === "open"} title="EEG stream transport">
      {stream.transport} · {LABEL[stream.status]} · {stream.rateHz.toFixed(0)} Hz
    </Badge>
  );
}
