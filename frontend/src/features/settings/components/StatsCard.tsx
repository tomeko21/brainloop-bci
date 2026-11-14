import { Activity, BarChart3, Clock, Eye, Heart, Zap } from "lucide-react";
import { useMemo } from "react";
import { Card, CardTitle, Sparkline, StatTile } from "@/components/ui";
import { useUserStats } from "@/hooks/useUser";
import { useCsvLogStore } from "@/store/csvLogStore";
import { useSessionStore } from "@/store/sessionStore";
import { formatDuration, formatPercent } from "@/lib/format";

/** Stats: current session (from local CSV) + all sessions (from the backend DB). */
export function StatsCard() {
  const session = useSessionStore((s) => s.session);
  const rows = useCsvLogStore((s) => s.rows);
  const stats = useUserStats({ subjectName: session?.subjectName ?? "" });

  const live = useMemo(() => {
    const mine = rows.filter((r) => r.sessionId === session?.id);
    const ends = mine.filter((r) => r.event === "reel_view_end");
    const total = ends.reduce((a, r) => a + Number(r.value || 0), 0);
    return {
      viewed: new Set(mine.filter((r) => r.event === "reel_view_start").map((r) => r.reelId)).size,
      likes: mine.filter((r) => r.event === "reel_like").length - mine.filter((r) => r.event === "reel_unlike").length,
      avg: ends.length ? total / ends.length / 1000 : 0,
    };
  }, [rows, session?.id]);

  return (
    <Card className="sm:col-span-2">
      <CardTitle icon={<BarChart3 className="size-3.5" />} right={<span className="font-mono text-[10px] uppercase text-muted">live + db</span>}>
        Stats
      </CardTitle>
      <p className="mb-2 text-xs uppercase tracking-wider text-muted">This session</p>
      <div className="grid grid-cols-3 gap-3">
        <StatTile index={0} icon={<Eye className="size-3" />} label="Reels" value={live.viewed} accent="cyan" />
        <StatTile index={1} icon={<Heart className="size-3" />} label="Likes" value={Math.max(0, live.likes)} accent="pink" />
        <StatTile index={2} icon={<Clock className="size-3" />} label="Avg. time" value={`${live.avg.toFixed(1)}s`} accent="violet" />
      </div>

      <p className="mb-2 mt-5 text-xs uppercase tracking-wider text-muted">All sessions</p>
      {stats.isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-24 rounded-ui" />)}
        </div>
      ) : stats.data ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile index={0} icon={<Eye className="size-3" />} label="Watched" value={stats.data.reelsWatched} accent="cyan" />
            <StatTile index={1} icon={<Heart className="size-3" />} label="Liked" value={stats.data.likesGiven} accent="pink" />
            <StatTile index={2} icon={<Clock className="size-3" />} label="Total time" value={formatDuration(stats.data.totalSessionTimeSec)} accent="lime" />
            <StatTile index={3} icon={<Zap className="size-3" />} label="Avg. fatigue" value={formatPercent(stats.data.avgFatigue)} accent="violet" />
          </div>
          <div className="mt-4 rounded-ui bg-surface p-4">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted"><Activity className="size-3" />Focus trend</p>
            <Sparkline values={stats.data.focusTrend} className="mt-2 h-20 w-full" />
          </div>
        </>
      ) : null}
    </Card>
  );
}
