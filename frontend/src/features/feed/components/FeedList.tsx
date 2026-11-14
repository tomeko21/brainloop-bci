import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorState, LoadingState } from "@/components/feedback";
import { useFeed, useToggleLike } from "@/hooks/useFeed";
import { logEvent } from "@/store/csvLogStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { Reel } from "@/types/domain";
import { useActiveReelTracking } from "../useActiveReelTracking";
import { usePlaybackClock } from "../usePlaybackClock";
import { useScrollTracker } from "../useScrollTracker";
import { usePullToRefresh } from "../usePullToRefresh";
import { ReelCard } from "./ReelCard";
import { FeedEnd } from "./FeedEnd";
import { FeedTopBar } from "./FeedTopBar";
import { PullIndicator } from "./PullIndicator";

/** Vertical Reels-style feed: snap-scroll, infinite loading, pull-to-refresh. */
export function FeedList() {
  const calm = useSettingsStore((s) => s.calmFilter);
  const feed = useFeed({ calmFilter: calm });
  const { mutate: toggleLike } = useToggleLike();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const reels = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);
  const activeReel = reels[activeIndex];

  // Data collection: scroll speed, playback clock (loop), reel views
  const scroll = useScrollTracker(scrollRef, activeIndex, reels.length > 0);
  usePlaybackClock(activeReel);
  useActiveReelTracking(activeReel, activeIndex, {
    getReel: (id) => reels.find((r) => r.id === id),
    takeScrollPeak: scroll.takePeak,
  });

  const scrollTo = useCallback((index: number) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: index * el.clientHeight, behavior: "smooth" });
  }, []);

  const { refetch } = feed;
  const onRefresh = useCallback(async () => {
    logEvent("feed_refresh");
    scrollTo(0);
    await Promise.all([refetch(), new Promise((r) => setTimeout(r, 700))]);
  }, [refetch, scrollTo]);
  const ptr = usePullToRefresh(scrollRef, onRefresh, reels.length > 0);

  // Which reel is visible (>= 60% of height)
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveIndex(Number((e.target as HTMLElement).dataset.index));
        }
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll("[data-index]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [reels.length]);

  // Load the next page when nearing the end
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;
  useEffect(() => {
    if (activeIndex >= reels.length - 3 && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [activeIndex, reels.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Filter changed -> scroll back to top
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setActiveIndex(0);
  }, [calm]);

  // Keyboard: ↑/↓ and j/k
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); scrollTo(Math.min(activeIndex + 1, reels.length)); }
      if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); scrollTo(Math.max(activeIndex - 1, 0)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, reels.length, scrollTo]);

  const handleLike = useCallback(
    (reel: Reel, like: boolean) => {
      logEvent(like ? "reel_like" : "reel_unlike", { reelId: reel.id });
      toggleLike({ reelId: reel.id, like });
    },
    [toggleLike],
  );

  return (
    <div className="relative mx-auto h-dvh w-full max-w-[480px] overflow-hidden bg-black sm:my-0 sm:border-x sm:border-white/10 sm:shadow-[0_0_120px_-20px_rgb(167_139_250/0.35)]">
      <FeedTopBar calm={calm} onRefresh={() => void ptr.refresh()} refreshing={ptr.refreshing} />
      <PullIndicator pull={ptr.pull} progress={ptr.progress} refreshing={ptr.refreshing} />

      {feed.isPending ? (
        <div className="grid h-full place-items-center"><LoadingState label="Loading feed" /></div>
      ) : feed.isError ? (
        <div className="grid h-full place-items-center"><ErrorState message={feed.error.message} onRetry={() => void feed.refetch()} /></div>
      ) : (
        <div
          ref={scrollRef}
          className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain transition-transform duration-300"
          style={{ transform: `translateY(${ptr.pull * 0.6}px)` }}
        >
          {reels.map((reel, i) => (
            <ReelCard key={reel.id} reel={reel} index={i} active={i === activeIndex} calm={calm} onLike={handleLike} />
          ))}
          {isFetchingNextPage && <div className="grid h-full shrink-0 snap-start place-items-center"><LoadingState /></div>}
          {!hasNextPage && <FeedEnd />}
        </div>
      )}

      {/* Navigation arrows – useful on desktop */}
      <div className="absolute right-4 top-20 z-20 hidden flex-col gap-2 md:flex">
        {[
          { icon: ChevronUp, dir: -1, label: "Previous reel" },
          { icon: ChevronDown, dir: 1, label: "Next reel" },
        ].map(({ icon: Icon, dir, label }) => (
          <button
            key={dir}
            type="button"
            aria-label={label}
            onClick={() => scrollTo(Math.max(0, activeIndex + dir))}
            className="grid size-9 cursor-pointer place-items-center rounded-full bg-white/10 text-white opacity-60 backdrop-blur transition hover:opacity-100"
          >
            <Icon className="size-5" />
          </button>
        ))}
      </div>
    </div>
  );
}
