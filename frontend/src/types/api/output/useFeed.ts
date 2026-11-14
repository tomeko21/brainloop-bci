import type { Reel } from "@/types/domain";

export interface FeedPageOutput {
  items: Reel[];
  nextCursor: number | null;
}

export interface ToggleLikeOutput {
  reelId: string;
  likes: number;
  likedByMe: boolean;
}

export interface ReportActiveReelOutput {
  ok: true;
  receivedAtMs: number;
}
