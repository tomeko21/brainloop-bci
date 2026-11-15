import type { FaceLiveSummary, MlPrediction, PlaybackSnapshot, Reel } from "@/types/domain";
import type { VideoFeatures } from "./useFrames";

// background = tab hidden, offline = no recent heartbeat
export type ViewerStatus = "online" | "background" | "offline";

export interface LiveViewerOutput {
  status: ViewerStatus;
  sessionId: string | null;
  subjectName: string | null;
  reel: Reel | null;
  reelIndex: number;
  lastSeenMsAgo: number | null;
  viewStartedAtMs: number | null;
  playback: PlaybackSnapshot | null;  // at heartbeat time, the admin extrapolates to now
  heartbeatAtMs: number | null;
  face: FaceLiveSummary | null;
  prediction: MlPrediction | null;  // computed on the viewer's device
  video: VideoFeatures | null;  // server-side frame analysis
  calmIntensity: number;
}

export type LiveEventsOutput = import("@/types/api/input/useFeed").LiveEventRow[];
