import { Leaf, Moon, Palette, ScanFace, Sun } from "lucide-react";
import { Card, CardTitle, SegmentedControl, Switch } from "@/components/ui";
import { logEvent } from "@/store/csvLogStore";
import { useSettingsStore, type ThemeMode } from "@/store/settingsStore";

function Row({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl p-3 transition-colors hover:bg-surface">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-strong">{icon}</div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-xs text-muted">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function AppearanceCard() {
  const { theme, calmFilter, showCameraPreview, setTheme, setCalmFilter, setShowCameraPreview } = useSettingsStore();

  return (
    <Card>
      <CardTitle icon={<Palette className="size-3.5" />}>Appearance & filter</CardTitle>
      <p className="mb-2 text-sm text-muted">Background</p>
      <SegmentedControl<ThemeMode>
        value={theme}
        onChange={(t) => {
          setTheme(t);
          logEvent("settings_change", { value: `theme=${t}` });
        }}
        options={[
          { value: "dark", label: "Black", icon: <Moon className="size-4" /> },
          { value: "light", label: "White", icon: <Sun className="size-4" /> },
        ]}
      />
      <div className="mt-4 space-y-1">
        <Row icon={<Leaf className="size-5 text-ok" />} title="Calm filter" desc="Calmer reels and muted colors">
          <Switch
            checked={calmFilter}
            label="Calm filter"
            onChange={(on) => {
              setCalmFilter(on);
              logEvent("settings_change", { value: `calm_filter=${on}` });
            }}
          />
        </Row>
        <Row icon={<ScanFace className="size-5 text-neon-cyan" />} title="Camera preview" desc="Small preview in the corner while recording">
          <Switch checked={showCameraPreview} onChange={setShowCameraPreview} label="Camera preview" />
        </Row>
      </div>
    </Card>
  );
}
