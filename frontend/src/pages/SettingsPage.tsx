import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileCard } from "@/features/settings/components/ProfileCard";
import { AppearanceCard } from "@/features/settings/components/AppearanceCard";
import { StatsCard } from "@/features/settings/components/StatsCard";
import { DataCard } from "@/features/settings/components/DataCard";
import { SessionActions } from "@/features/settings/components/SessionActions";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-32 pt-10">
      <PageHeader eyebrow="Profile · Configuration" title="Settings" />
      <div className="grid gap-4 sm:grid-cols-2">
        <ProfileCard />
        <AppearanceCard />
        <DataCard />
        <StatsCard />
        <SessionActions />
      </div>
    </div>
  );
}
