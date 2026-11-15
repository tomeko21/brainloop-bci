import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Button, Logo } from "@/components/ui";
import { useNow } from "@/lib/useNow";
import { formatTime } from "@/lib/format";
import { useHealth } from "@/hooks/useHealth";
import { EegStatusBadge } from "@/features/recording/components/EegStatusBadge";

export function AdminHeader() {
  const now = useNow();
  const health = useHealth();
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <Logo />
        <div className="hidden h-8 w-px bg-border sm:block" />
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-neon-cyan">Admin</p>
          <h1 className="text-xl font-semibold tracking-tight">Mission Control</h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {health.isError ? (
          <Badge tone="danger">backend offline</Badge>
        ) : health.data ? (
          <>
            <Badge tone={health.data.status === "ok" ? "ok" : "warn"} dot>
              API · {health.data.activeReels} reels
            </Badge>
            <EegStatusBadge className="py-1" />
            <Badge tone="violet">{health.data.modelVersion}</Badge>
          </>
        ) : null}
        <span className="font-mono text-sm tabular-nums text-muted">{formatTime(now)}</span>
        <Link to="/">
          <Button variant="secondary" size="sm"><ArrowLeft className="size-3.5" />App</Button>
        </Link>
      </div>
    </header>
  );
}
