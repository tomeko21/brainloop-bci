import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "dark" | "light";

interface SettingsState {
  /** App background: black (dark) or white (light). */
  theme: ThemeMode;
  /** Calm filter enabled: on a dopamine peak (high BRI) slowly fades colours, slows playback, lowers volume + 5-min reminders. */
  calmFilter: boolean;
  /** Floating camera preview on the feed. */
  showCameraPreview: boolean;
  /** After the session ends, also download a ZIP (in addition to saving to data/). */
  autoDownloadZip: boolean;
  /** Reel sound off. */
  muted: boolean;
  setMuted: (muted: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  setCalmFilter: (on: boolean) => void;
  setShowCameraPreview: (on: boolean) => void;
  setAutoDownloadZip: (on: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "dark",
      muted: false,
      setMuted: (muted) => set({ muted }),
      calmFilter: true,
      showCameraPreview: true,
      autoDownloadZip: false,
      setTheme: (theme) => set({ theme }),
      setCalmFilter: (calmFilter) => set({ calmFilter }),
      setShowCameraPreview: (showCameraPreview) => set({ showCameraPreview }),
      setAutoDownloadZip: (autoDownloadZip) => set({ autoDownloadZip }),
    }),
    { name: "brainloop.settings" },
  ),
);
