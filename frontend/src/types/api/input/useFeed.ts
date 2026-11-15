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

// GET /api/feed
export interface FeedPageInput {
  sessionId: string;  // backend remembers per session what it already served
  cursor: number;
  limit: number;
}

// POST /api/feed/{reelId}/like
export interface ToggleLikeInput {
  sessionId: string;
  reelId: string;
  like: boolean;
}

// POST /api/live/active-reel, the feed heartbeat
export interface ReportActiveReelInput {
  sessionId: string;
  subjectName: string;
  reelId: string;
  reelIndex: number;
  playback: PlaybackSnapshot;
  visible: boolean;  // false = background tab or screen off
  left?: boolean;  // user left the feed (pagehide, session end)
  face: FaceLiveSummary | null;
  calmIntensity: number;
  events: LiveEventRow[];  // events.csv rows since the previous heartbeat
  prediction: MlPrediction | null;
}
