/**
 * Feed API.
 * ⚠️ MOCK: when USE_MOCKS === true the data comes from ./mocks/reels.mock.ts
 *          and a "database" in localStorage (./mocks/mockDb.ts).
 */
import type { FeedPageInput, ReportActiveReelInput, ToggleLikeInput } from "@/types/api/input/useFeed";
import type { FeedPageOutput, ReportActiveReelOutput, ToggleLikeOutput } from "@/types/api/output/useFeed";
import { USE_MOCKS, http, mockDelay } from "./client";
import { MOCK_TOTAL_REELS, generateMockReel } from "./mocks/reels.mock";
import { readDb, writeDb } from "./mocks/mockDb";

export async function fetchFeedPage(input: FeedPageInput): Promise<FeedPageOutput> {
  if (!USE_MOCKS) {
    const q = new URLSearchParams({ cursor: String(input.cursor), limit: String(input.limit), calm: String(input.calmFilter) });
    return http<FeedPageOutput>(`/api/feed?${q}`);
  }

  // --- MOCK ---
  await mockDelay(350, 800);
  const likes = readDb().likes;
  const items = [];
  let i = input.cursor;
  // Calm filter: skip "intense" reels (the backend will do this based on EEG/camera)
  while (items.length < input.limit && i < MOCK_TOTAL_REELS) {
    const reel = generateMockReel(i);
    i++;
    if (input.calmFilter && reel.mood === "intense") continue;
    const liked = likes[reel.id] ?? false;
    items.push({ ...reel, likedByMe: liked, likes: reel.likes + (liked ? 1 : 0) });
  }
  return { items, nextCursor: i < MOCK_TOTAL_REELS ? i : null };
}

export async function toggleLike(input: ToggleLikeInput): Promise<ToggleLikeOutput> {
  if (!USE_MOCKS) return http<ToggleLikeOutput>(`/api/feed/${input.reelId}/like`, { method: "POST", body: { like: input.like } });

  // --- MOCK ---
  await mockDelay(120, 300);
  writeDb((db) => ({ ...db, likes: { ...db.likes, [input.reelId]: input.like } }));
  const index = Number(input.reelId.replace("reel_", ""));
  const base = generateMockReel(index).likes;
  return { reelId: input.reelId, likedByMe: input.like, likes: base + (input.like ? 1 : 0) };
}

export async function reportActiveReel(input: ReportActiveReelInput): Promise<ReportActiveReelOutput> {
  if (!USE_MOCKS) return http<ReportActiveReelOutput>("/api/live/active-reel", { method: "POST", body: input });

  // --- MOCK --- written to localStorage, which the admin panel reads (another tab)
  const now = Date.now();
  writeDb((db) => ({
    ...db,
    activeReel: {
      ...input,
      heartbeatAtMs: now,
      viewStartedAtMs:
        db.activeReel?.reelId === input.reelId && db.activeReel.sessionId === input.sessionId ? db.activeReel.viewStartedAtMs : now,
    },
  }));
  return { ok: true, receivedAtMs: now };
}
