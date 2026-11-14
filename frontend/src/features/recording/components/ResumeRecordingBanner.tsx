import { AnimatePresence, motion } from "motion/react";
import { CameraOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";
import { useSessionLifecycle } from "@/features/session/useSessionLifecycle";
import { useRecordingStore } from "@/store/recordingStore";
import { useSessionStore } from "@/store/sessionStore";

/**
 * Session with camera, but the camera is not recording (e.g. after a page refresh) ->
 * offer to resume. Previously recorded segments are safe in IndexedDB.
 */
export function ResumeRecordingBanner() {
  const cameraSession = useSessionStore((s) => !!s.session?.cameraEnabled && s.segmentCount > 0);
  const segments = useSessionStore((s) => s.segmentCount);
  const idle = useRecordingStore((s) => s.status === "idle" || s.status === "error");
  const { resume, resuming, error } = useSessionLifecycle();
  const show = cameraSession && idle;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          className="fixed inset-x-3 top-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-warn/30 bg-black/75 p-3 text-white shadow-2xl backdrop-blur-md"
        >
          <CameraOff className="size-5 shrink-0 text-warn" />
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-medium">Recording interrupted</p>
            <p className="text-white/60">
              {error ?? `Saved segments: ${segments}. Resuming will add another.`}
            </p>
          </div>
          <Button size="sm" loading={resuming} onClick={() => void resume()}>
            <RotateCcw className="size-3.5" /> Resume
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
