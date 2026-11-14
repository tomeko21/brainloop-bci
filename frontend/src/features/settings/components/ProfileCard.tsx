import { Cpu, Hash, ShieldCheck, Timer } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { useUserProfile } from "@/hooks/useUser";
import { useRecordingStore } from "@/store/recordingStore";
import { useSessionStore } from "@/store/sessionStore";
import { formatDuration, formatTime } from "@/lib/format";
import { useNow } from "@/lib/useNow";

export function ProfileCard() {
  const session = useSessionStore((s) => s.session);
  const recording = useRecordingStore((s) => s.status === "recording");
  const profile = useUserProfile({ subjectName: session?.subjectName ?? "" });
  const now = useNow();
  if (!session) return null;
  const hue = profile.data?.avatarHue ?? 270;

  const rows = [
    { icon: Hash, label: "Session", value: session.id },
    { icon: Cpu, label: "Device", value: profile.data?.deviceId ?? "…" },
    { icon: Timer, label: "Start", value: formatTime(session.startedAtMs) },
    { icon: ShieldCheck, label: "Duration", value: formatDuration((now - session.startedAtMs) / 1000) },
  ];

  return (
    <Card glow className="sm:col-span-2">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative">
          <div
            className="size-16 rounded-2xl"
            style={{ background: `conic-gradient(from 120deg, hsl(${hue} 90% 60%), hsl(${(hue + 120) % 360} 90% 55%), hsl(${hue} 90% 60%))` }}
          />
          <span className="absolute inset-0 grid place-items-center text-2xl font-semibold text-white">
            {session.subjectName.slice(0, 1).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-2xl font-semibold">{session.subjectName}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge tone="violet">{profile.data?.role === "admin" ? "admin" : "study participant"}</Badge>
            {recording ? <Badge tone="danger" dot>recording</Badge> : <Badge>camera off</Badge>}
          </div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl bg-surface p-3">
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted"><Icon className="size-3" />{label}</p>
            <p className="mt-1 truncate font-mono text-sm">{value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
