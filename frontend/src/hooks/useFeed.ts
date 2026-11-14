import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { fetchFeedPage, reportActiveReel, toggleLike } from "@/api/feed.api";
import type { FeedPageInput, ReportActiveReelInput, ToggleLikeInput } from "@/types/api/input/useFeed";
import type { FeedPageOutput, ReportActiveReelOutput, ToggleLikeOutput } from "@/types/api/output/useFeed";
import { queryKeys } from "./queryKeys";
import { FEED } from "@/config/tuning";

/** Reels per request – the backend picks them in batches so the API is not hit on every swipe. */
const PAGE_SIZE = FEED.pageSize;

/** Infinite reel feed (cursor pagination). */
export function useFeed({
  sessionId,
  startCursor = 0,
}: Pick<FeedPageInput, "sessionId"> & { startCursor?: number }) {
  return useInfiniteQuery<FeedPageOutput, Error, InfiniteData<FeedPageOutput>, ReturnType<typeof queryKeys.feed>, number>({
    queryKey: queryKeys.feed(sessionId, startCursor),
    queryFn: ({ pageParam }) => fetchFeedPage({ sessionId, cursor: pageParam, limit: PAGE_SIZE }),
    enabled: sessionId.length > 0,
    // A refresh starts from a new cursor -> the backend picks fresh reels
    initialPageParam: startCursor,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 60_000,
  });
}

/** Like / unlike with an optimistic cache update. */
export function useToggleLike() {
  const qc = useQueryClient();

  const patch = (reelId: string, likedByMe: boolean, likes?: number) =>
    qc.setQueriesData<InfiniteData<FeedPageOutput>>({ queryKey: queryKeys.feedAll }, (data) =>
      data && {
        ...data,
        pages: data.pages.map((p) => ({
          ...p,
          items: p.items.map((r) =>
            r.id === reelId ? { ...r, likedByMe, likes: likes ?? r.likes + (likedByMe ? 1 : -1) } : r,
          ),
        })),
      },
    );

  return useMutation<ToggleLikeOutput, Error, ToggleLikeInput>({
    mutationFn: toggleLike,
    onMutate: ({ reelId, like }) => patch(reelId, like),
    onError: (_e, { reelId, like }) => patch(reelId, !like),
    onSuccess: (res) => patch(res.reelId, res.likedByMe, res.likes),
  });
}

/** Heartbeat: which reel the user is watching now (read by the admin panel). */
export function useReportActiveReel() {
  return useMutation<ReportActiveReelOutput, Error, ReportActiveReelInput>({
    mutationFn: reportActiveReel,
  });
}
