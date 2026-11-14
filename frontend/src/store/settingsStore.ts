import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "dark" | "light";

interface SettingsState {
  /** App background: black (dark) or white (light). */
  theme: ThemeMode;
  /** Calm filter: calmer reels + muted colors. */
  calmFilter: boolean;
  /** Floating camera preview on the feed. */
  showCameraPreview: boolean;
  /** After the session ends, also download a ZIP (in addition to saving to data/). */
  autoDownloadZip: boolean;
  setTheme: (theme: ThemeMode) => void;
  setCalmFilter: (on: boolean) => void;
  setShowCameraPreview: (on: boolean) => void;
  setAutoDownloadZip: (on: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "dark",
      calmFilter: false,
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
