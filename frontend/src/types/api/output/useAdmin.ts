import type { FaceLiveSummary, MlPrediction, PlaybackSnapshot, Reel } from "@/types/domain";
import type { VideoFeatures } from "./useFrames";

/** online = watching now, background = tab in background, offline = no signal */
export type ViewerStatus = "online" | "background" | "offline";

export interface LiveViewerOutput {
  status: ViewerStatus;
  sessionId: string | null;
  subjectName: string | null;
  reel: Reel | null;
  reelIndex: number;
  /** How many ms ago the last heartbeat from the feed arrived. */
  lastSeenMsAgo: number | null;
  viewStartedAtMs: number | null;
  /** Playback state at the time of the heartbeat – the admin extrapolates it to "now". */
  playback: PlaybackSnapshot | null;
  heartbeatAtMs: number | null;
  face: FaceLiveSummary | null;
  /** BRI from the AI model computed on the user's device. */
  prediction: MlPrediction | null;
  /** Server-side analysis of the camera frames (OpenCV). */
  video: VideoFeatures | null;
  /** Calm filter intensity 0..1 on the viewer's device. */
  calmIntensity: number;
}

export type LiveEventsOutput = import("@/types/api/input/useFeed").LiveEventRow[];
