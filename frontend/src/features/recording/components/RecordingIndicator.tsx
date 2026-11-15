import { AnimatePresence, motion } from "motion/react";
import { useRecordingStore } from "@/store/recordingStore";
import { formatDuration } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { useEegStatus } from "@/hooks/useEeg";

export function RecordingIndicator() {
  const status = useRecordingStore((s) => s.status);
  const startedAtMs = useRecordingStore((s) => s.startedAtMs);
  const now = useNow(1_000, status === "recording");
  const eegRecording = !!useEegStatus().data?.recording;

  return (
    <AnimatePresence>
      {status === "recording" && startedAtMs && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          className="fixed left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 font-mono text-xs text-white backdrop-blur-md"
        >
          <span className="relative flex size-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-red-500" />
            <span className="relative size-2 rounded-full bg-red-500" />
          </span>
          REC {formatDuration((now - startedAtMs) / 1000)}
          {eegRecording && <span className="rounded bg-ok/30 px-1 text-[10px] text-ok">+EEG</span>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
