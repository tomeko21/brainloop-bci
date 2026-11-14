import { useEegStatus, useEegStream } from "@/hooks/useEeg";
import { EegConnectPanel } from "@/features/recording/components/EegConnectPanel";
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
  const status = useEegStatus();
  // EEG is shown only while the headset actually streams (there is no mock data)
  const live = status.data?.state === "streaming" && !!eeg.data;
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <AdminHeader />
      {!live && <EegConnectPanel className="mb-4 max-w-xl" />}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <BriHeader eeg={eeg} live={live} />
        <LiveReelMirror />
        <BrainMap stream={eeg} live={live} />
        <div className="flex flex-col gap-4 md:col-span-2 lg:col-span-1">
          <FatiguePanel data={eeg.data} live={live} />
          <FacePanel />
        </div>
        <ChannelPanel data={eeg.data} live={live} />
        <EventLog />
      </div>
    </div>
  );
}
