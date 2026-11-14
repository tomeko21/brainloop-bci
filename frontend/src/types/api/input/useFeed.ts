import type { FaceLiveSummary, MlPrediction, PlaybackSnapshot } from "@/types/domain";

/** GET /api/feed?cursor=&limit=&calm= */
export interface FeedPageInput {
  cursor: number;
  limit: number;
  /** When the calm filter is active, the backend serves calmer reels. */
  calmFilter: boolean;
}

/** POST /api/feed/{reelId}/like */
export interface ToggleLikeInput {
  reelId: string;
  like: boolean;
}

/** POST /api/live/active-reel – heartbeat: what and how the user is watching now. */
export interface ReportActiveReelInput {
  sessionId: string;
  subjectName: string;
  reelId: string;
  reelIndex: number;
  playback: PlaybackSnapshot;
  /** false = tab in background / screen off */
  visible: boolean;
  /** true = the user left the feed (pagehide / session end) */
  left?: boolean;
  /** Face feature summary (null when the camera is off). */
  face: FaceLiveSummary | null;
  /** Latest AI model prediction (BRI from camera + scroll). */
  prediction: MlPrediction | null;
}
