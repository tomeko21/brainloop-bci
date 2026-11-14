import { AnimatePresence, motion } from "motion/react";
import { EyeOff, MonitorSmartphone, Pause, WifiOff } from "lucide-react";
import { Badge, Card, CardTitle } from "@/components/ui";
import { ReelPlayer } from "@/features/feed/components/ReelPlayer";
import { ProgressBar } from "@/features/feed/components/ProgressBar";
import { useLiveViewer } from "@/hooks/useAdmin";
import { formatDuration } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import type { LiveViewerOutput } from "@/types/api/output/useAdmin";

const STATUS_BADGE = {
  online: <Badge tone="ok" dot>online</Badge>,
  background: <Badge tone="warn">tab in background</Badge>,
  offline: <Badge>offline</Badge>,
};

/** Playback position "now" = position from the heartbeat + time since the heartbeat (with looping). */
function extrapolate(v: LiveViewerOutput | undefined, now: number) {
  const pb = v?.playback;
  if (!pb || !v?.heartbeatAtMs) return { progress: 0, loop: 0 };
  const running = v.status === "online" && !pb.paused;
  const abs = pb.loops * pb.durationMs + pb.positionMs + (running ? Math.max(0, now - v.heartbeatAtMs) : 0);
  return { progress: (abs % pb.durationMs) / pb.durationMs, loop: Math.floor(abs / pb.durationMs) };
}

/** Mirror of the reel being watched NOW on another device (mock: in another tab). */
export function LiveReelMirror() {
  const { data } = useLiveViewer();
  const now = useNow(100);
  const hasReel = data?.status !== "offline" && !!data?.reel;
  const { progress, loop } = extrapolate(data, now);
  const paused = data?.playback?.paused || data?.status === "background";

  return (
    <Card className="flex flex-col">
      <CardTitle icon={<MonitorSmartphone className="size-3.5" />} right={STATUS_BADGE[data?.status ?? "offline"]}>
        Current reel
      </CardTitle>

      <div className="relative mx-auto aspect-[9/16] w-full max-w-[220px] overflow-hidden rounded-[1.75rem] border-4 border-zinc-800 bg-black shadow-[0_20px_60px_-20px_rgb(0_0_0/0.8)]">
        <AnimatePresence mode="wait">
          {hasReel && data?.reel ? (
            <motion.div key={data.reel.id} className="absolute inset-0"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "-100%" }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
              <ReelPlayer reel={data.reel} playing={!paused} calm={false} progressBar={<ProgressBar progress={progress} loop={loop} />} />
              {paused && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="grid size-14 place-items-center rounded-full bg-black/50 text-white backdrop-blur">
                    {data.status === "background" ? <EyeOff className="size-6" /> : <Pause className="size-6 fill-white" />}
                  </div>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                <p className="text-xs font-semibold">@{data.reel.author.handle}</p>
                <p className="line-clamp-2 text-[11px] text-white/80">{data.reel.caption}</p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="off" className="absolute inset-0 grid place-items-center p-4 text-center text-white/60"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div>
                <WifiOff className="mx-auto size-8" />
                <p className="mt-2 text-xs">Nobody is watching right now.<br />Open the feed on another device or in another tab.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        {[
          ["User", data?.subjectName ?? "—"],
          ["Reel", hasReel && data?.reel ? `#${data.reelIndex} · ${data.reel.id}` : "—"],
          ["Watching for", hasReel && data?.viewStartedAtMs ? formatDuration((now - data.viewStartedAtMs) / 1000) : "—"],
          ["Loop / pass", hasReel ? `pass ${loop + 1} · ${Math.round(progress * 100)}%` : "—"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-surface p-2">
            <dt className="text-muted">{k}</dt>
            <dd className="truncate font-mono">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
