import { AnimatePresence, motion } from "motion/react";
import { useRef } from "react";
import { useRecordingStore } from "@/store/recordingStore";
import { useSettingsStore } from "@/store/settingsStore";
import { CameraPreview } from "./CameraPreview";

export function CameraPip() {
  const stream = useRecordingStore((s) => s.stream);
  const recording = useRecordingStore((s) => s.status === "recording");
  const visible = useSettingsStore((s) => s.showCameraPreview);
  const constraints = useRef<HTMLDivElement>(null);

  return (
    <div ref={constraints} className="pointer-events-none fixed inset-3 z-40">
      <AnimatePresence>
        {recording && visible && stream && (
          <motion.div
            drag
            dragConstraints={constraints}
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            whileDrag={{ scale: 1.05 }}
            className="pointer-events-auto absolute right-0 top-12 h-32 w-24 cursor-grab overflow-hidden rounded-2xl border border-white/15 shadow-[0_10px_40px_-8px_rgb(0_0_0/0.7)] active:cursor-grabbing"
          >
            <CameraPreview stream={stream} />
            <div className="absolute inset-x-0 top-0 h-6 animate-scan bg-gradient-to-b from-neon-cyan/0 via-neon-cyan/25 to-neon-cyan/0" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
