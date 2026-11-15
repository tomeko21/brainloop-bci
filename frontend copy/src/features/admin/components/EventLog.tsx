import { AnimatePresence, motion } from "motion/react";
import { ScrollText } from "lucide-react";
import { Card, CardTitle } from "@/components/ui";
import { EmptyState } from "@/components/feedback";
import { useLiveEvents } from "@/hooks/useAdmin";
import { formatTime } from "@/lib/format";
import type { CsvEventType } from "@/types/domain";

const TONE: Partial<Record<CsvEventType, string>> = {
  reel_like: "text-neon-pink",
  reel_view_start: "text-neon-cyan",
  recording_start: "text-danger",
  recording_end: "text-danger",
  session_start: "text-ok",
  session_end: "text-ok",
  feed_refresh: "text-neon-violet",
};

// Tail of the watched session's events.csv, new rows arrive with each feed heartbeat.
export function EventLog() {
  const { data } = useLiveEvents();
  const tail = data ?? [];

  return (
    <Card className="md:col-span-2 lg:col-span-3">
      <CardTitle icon={<ScrollText className="size-3.5" />} right={<span className="font-mono text-[10px] text-muted">{tail.length} latest</span>}>
        Event stream (CSV)
      </CardTitle>
      {tail.length === 0 ? (
        <EmptyState title="No events" description="Start a session and scroll the feed." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] font-mono text-xs">
            <thead className="text-left text-muted">
              <tr>{["time", "t_rel", "user", "event", "reel", "value"].map((h) => <th key={h} className="pb-2 font-normal">{h}</th>)}</tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {tail.map((r) => (
                  <motion.tr key={`${r.tsMs}-${r.event}-${r.reelId}`} layout initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="border-t border-border">
                    <td className="py-1.5 text-muted">{formatTime(r.tsMs)}</td>
                    <td>{(r.tRelMs / 1000).toFixed(1)}s</td>
                    <td>{r.subjectName}</td>
                    <td className={TONE[r.event as CsvEventType] ?? ""}>{r.event}</td>
                    <td>{r.reelId || "—"}</td>
                    <td className="max-w-[120px] truncate">{r.value || "—"}</td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
