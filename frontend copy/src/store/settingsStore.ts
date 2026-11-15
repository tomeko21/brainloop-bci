import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "dark" | "light";

interface SettingsState {
  theme: ThemeMode;
  calmFilter: boolean;  // fade colors, slow playback and lower volume on high BRI
  showCameraPreview: boolean;
  autoDownloadZip: boolean;  // ZIP on top of the backend save
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
