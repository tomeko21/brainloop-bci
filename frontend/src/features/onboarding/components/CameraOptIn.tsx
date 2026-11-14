import { AnimatePresence, motion } from "motion/react";
import { Camera, CameraOff, Clock, Eye, FileSpreadsheet, MicOff } from "lucide-react";
import { useEffect } from "react";
import { Switch } from "@/components/ui";
import { CameraPreview } from "@/features/recording/components/CameraPreview";
import { closePreview, isCameraSupported, openPreview } from "@/services/cameraRecorder";
import { preloadFaceModel } from "@/services/face/faceTracker";
import { useRecordingStore } from "@/store/recordingStore";

interface Props {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

const FACTS = [
  { icon: MicOff, text: "Video only – no audio" },
  { icon: Clock, text: "Start and end timestamps" },
  { icon: Eye, text: "MediaPipe: eyes, blinking, head pose" },
  { icon: FileSpreadsheet, text: "Everything to CSV" },
];

export function CameraOptIn({ enabled, onChange }: Props) {
  const stream = useRecordingStore((s) => s.stream);
  const status = useRecordingStore((s) => s.status);
  const error = useRecordingStore((s) => s.error);
  const supported = isCameraSupported();

  // Preview is enabled when the user ticks the camera; disabled when unticked
  useEffect(() => {
    if (enabled) {
      openPreview().catch(() => onChange(false));
      preloadFaceModel(); // the MediaPipe model loads before the user clicks Start
    }
    else closePreview();
  }, [enabled, onChange]);

  // Leaving the screen without starting a session -> release the camera (does nothing during recording)
  useEffect(() => () => closePreview(), []);

  return (
    <div className="glass overflow-hidden rounded-ui">
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-neon-cyan/15 text-neon-cyan">
            {enabled ? <Camera className="size-5" /> : <CameraOff className="size-5" />}
          </div>
          <div>
            <p className="font-medium">Camera recording</p>
            <p className="text-xs text-muted">
              {supported ? "Face → heart rate, blinking, head pose" : "Browser does not support recording"}
            </p>
          </div>
        </div>
        <Switch checked={enabled} onChange={onChange} disabled={!supported} label="Camera recording" />
      </div>

      <AnimatePresence initial={false}>
        {enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="px-4 pb-4">
              <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
                {stream ? (
                  <CameraPreview stream={stream} />
                ) : (
                  <div className="grid h-full place-items-center font-mono text-xs uppercase tracking-widest text-white/50">
                    {status === "requesting" ? "Requesting access…" : "No image"}
                  </div>
                )}
                {/* "Face tracking" reticle */}
                <div className="pointer-events-none absolute inset-[18%_30%] rounded-[40%] border-2 border-dashed border-neon-cyan/50" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-10 animate-scan bg-gradient-to-b from-transparent via-neon-cyan/20 to-transparent" />
                <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 font-mono text-[10px] uppercase text-neon-cyan">
                  preview
                </span>
              </div>
              {error && <p className="mt-2 text-xs text-danger">{error}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {FACTS.map(({ icon: Icon, text }) => (
                  <span key={text} className="flex items-center gap-1.5 rounded-full bg-surface-strong px-2.5 py-1 text-[11px] text-muted">
                    <Icon className="size-3" /> {text}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
