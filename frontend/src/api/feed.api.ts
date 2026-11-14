/** Feed API – reels come in batches chosen by the backend's reel selector. */
import type { FeedPageInput, ReportActiveReelInput, ToggleLikeInput } from "@/types/api/input/useFeed";
import type { FeedPageOutput, ReportActiveReelOutput, ToggleLikeOutput } from "@/types/api/output/useFeed";
import { http, query } from "./client";

export function fetchFeedPage(input: FeedPageInput): Promise<FeedPageOutput> {
  const q = query({ session_id: input.sessionId, cursor: input.cursor, limit: input.limit });
  return http<FeedPageOutput>(`/api/feed?${q}`);
}

export function toggleLike(input: ToggleLikeInput): Promise<ToggleLikeOutput> {
  return http<ToggleLikeOutput>(`/api/feed/${encodeURIComponent(input.reelId)}/like`, {
    method: "POST",
    body: { sessionId: input.sessionId, like: input.like },
  });
}

export function reportActiveReel(input: ReportActiveReelInput): Promise<ReportActiveReelOutput> {
  return http<ReportActiveReelOutput>("/api/live/active-reel", { method: "POST", body: input });
}
