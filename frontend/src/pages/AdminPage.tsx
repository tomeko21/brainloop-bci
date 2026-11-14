import { useEegStream } from "@/hooks/useEeg";
import { AdminHeader } from "@/features/admin/components/AdminHeader";
import { BrainMap } from "@/features/admin/components/BrainMap";
import { FatiguePanel } from "@/features/admin/components/FatiguePanel";
import { FacePanel } from "@/features/admin/components/FacePanel";
import { LiveReelMirror } from "@/features/admin/components/LiveReelMirror";
import { EventLog } from "@/features/admin/components/EventLog";
import { ChannelPanel } from "@/features/admin/components/ChannelPanel";
import { BriHeader } from "@/features/admin/components/BriHeader";

export default function AdminPage() {
  const eeg = useEegStream();
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <AdminHeader />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <BriHeader eeg={eeg} />
        <LiveReelMirror />
        <BrainMap stream={eeg} />
        <div className="flex flex-col gap-4 md:col-span-2 lg:col-span-1">
          <FatiguePanel data={eeg.data} />
          <FacePanel />
        </div>
        <ChannelPanel data={eeg.data} />
        <EventLog />
      </div>
    </div>
  );
}
