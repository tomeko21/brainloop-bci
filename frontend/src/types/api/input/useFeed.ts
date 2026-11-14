import type { FaceLiveSummary, MlPrediction, PlaybackSnapshot } from "@/types/domain";

export interface LiveEventRow {
  sessionId: string;
  subjectName: string;
  event: string;
  reelId: string;
  tsMs: number;
  tRelMs: number;
  value: string;
}

/** GET /api/feed?session_id=&cursor=&limit= */
export interface FeedPageInput {
  /** Pages are per session – the backend remembers what it already served. */
  sessionId: string;
  cursor: number;
  limit: number;
}

/** POST /api/feed/{reelId}/like */
export interface ToggleLikeInput {
  sessionId: string;
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
  /** Calm filter intensity 0..1 (admin mirror shows the same effect). */
  calmIntensity: number;
  /** events.csv rows logged since the previous heartbeat (admin's live event stream). */
  events: LiveEventRow[];
  /** Latest AI model prediction (BRI from camera + scroll). */
  prediction: MlPrediction | null;
}
