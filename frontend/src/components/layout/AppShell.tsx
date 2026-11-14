import { AnimatePresence, motion } from "motion/react";
import { useLocation, useOutlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { RecordingIndicator } from "@/features/recording/components/RecordingIndicator";
import { CameraPip } from "@/features/recording/components/CameraPip";
import { ResumeRecordingBanner } from "@/features/recording/components/ResumeRecordingBanner";
import { useLivePrediction } from "@/features/ml/useLivePrediction";

/** Layout for user screens (feed / settings) with animated page transitions. */
export function AppShell() {
  const location = useLocation();
  const outlet = useOutlet();
  useLivePrediction(); // AI computes BRI in the background throughout the session

  return (
    <div className="relative min-h-dvh">
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {outlet}
        </motion.main>
      </AnimatePresence>
      <RecordingIndicator />
      <ResumeRecordingBanner />
      <CameraPip />
      <BottomNav />
    </div>
  );
}
