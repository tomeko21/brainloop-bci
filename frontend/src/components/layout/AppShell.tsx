import { motion } from "motion/react";
import { useLocation, useOutlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { RecordingIndicator } from "@/features/recording/components/RecordingIndicator";
import { CameraPip } from "@/features/recording/components/CameraPip";
import { ResumeRecordingBanner } from "@/features/recording/components/ResumeRecordingBanner";
import { useLivePrediction } from "@/features/ml/useLivePrediction";
import { useFrameStreaming } from "@/features/recording/useFrameStreaming";
import { useCalmFilter } from "@/features/calm/useCalmFilter";
import { ScrollReminder } from "@/features/calm/components/ScrollReminder";
import { FeedList } from "@/features/feed/components/FeedList";
import { ROUTES } from "@/app/routes";
import { UI } from "@/config/tuning";

// Layout for feed and settings. Also runs the session-wide jobs: ML polling, frame upload, calm filter.
export function AppShell() {
  const location = useLocation();
  const outlet = useOutlet();
  const isFeed = location.pathname === ROUTES.feed;
  useLivePrediction();
  useFrameStreaming();
  useCalmFilter();

  return (
    <div className="relative min-h-dvh">
      {/* feed stays mounted for the whole session, only hidden, so switching tabs keeps the reel, video time and scroll */}
      <div
        aria-hidden={!isFeed}
        className={isFeed ? "relative" : "pointer-events-none invisible absolute inset-x-0 top-0"}
      >
        <FeedList visible={isFeed} />
      </div>

      {!isFeed && (
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: UI.pageFadeMs / 1000, ease: "easeOut" }}
        >
          {outlet}
        </motion.main>
      )}
      <RecordingIndicator />
      <ResumeRecordingBanner />
      <ScrollReminder />
      <CameraPip />
      <BottomNav />
    </div>
  );
}
