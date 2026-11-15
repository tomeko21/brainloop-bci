import { AnimatePresence, motion } from "motion/react";
import { Hourglass, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CALM_FILTER } from "@/config/calmFilter";
import { logEvent } from "@/store/csvLogStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";

export function ScrollReminder() {
  const enabled = useSettingsStore((s) => s.calmFilter);
  const startedAtMs = useSessionStore((s) => s.session?.startedAtMs ?? null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const lastBucket = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !startedAtMs) return;
    const bucketNow = () => Math.floor((Date.now() - startedAtMs) / CALM_FILTER.reminderEveryMs);
    // start from the current bucket so it doesn't fire right after a refresh
    lastBucket.current = bucketNow();

    const id = window.setInterval(() => {
      const bucket = bucketNow();
      if (bucket > (lastBucket.current ?? 0)) {
        lastBucket.current = bucket;
        const mins = Math.round((bucket * CALM_FILTER.reminderEveryMs) / 60_000);
        setMinutes(mins);
        logEvent("scroll_reminder", { value: mins });
      }
    }, 1_000);
    return () => window.clearInterval(id);
  }, [enabled, startedAtMs]);

  useEffect(() => {
    if (minutes === null) return;
    const t = window.setTimeout(() => setMinutes(null), CALM_FILTER.reminderVisibleMs);
    return () => window.clearTimeout(t);
  }, [minutes]);

  return (
    <AnimatePresence>
      {minutes !== null && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.96 }}
          className="fixed inset-x-3 top-14 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-ok/30 bg-black/80 p-3 text-white shadow-2xl"
          role="status"
        >
          <Hourglass className="size-5 shrink-0 text-ok" />
          <p className="flex-1 text-sm">
            You've been scrolling for <b>{minutes} min</b>. Maybe a short break?
          </p>
          <button type="button" onClick={() => setMinutes(null)} aria-label="Dismiss" className="cursor-pointer text-white/60 hover:text-white">
            <X className="size-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
