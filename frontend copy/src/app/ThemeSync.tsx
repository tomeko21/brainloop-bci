import { useEffect } from "react";
import { useSettingsStore } from "@/store/settingsStore";

export function ThemeSync() {
  const theme = useSettingsStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#05060a" : "#ffffff");
  }, [theme]);
  return null;
}
