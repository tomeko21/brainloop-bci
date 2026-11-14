/**
 * The vertical feed: snap scrolling, infinite batches of reels from the backend, pull-to-refresh,
 * keyboard navigation and the per-reel data collection hooks. Stays mounted across tabs (see AppShell).
 */
import { ChevronDown, ChevronUp } from "lucide-react";
import { FEED } from "@/config/tuning";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorState, LoadingState } from "@/components/feedback";
import { useFeed, useToggleLike } from "@/hooks/useFeed";
import { logEvent } from "@/store/csvLogStore";
import { useSessionStore } from "@/store/sessionStore";
import { usePlaybackStore } from "@/store/playbackStore";
import type { Reel } from "@/types/domain";
import { useActiveReelTracking } from "../useActiveReelTracking";
import { useScrollTracker } from "../useScrollTracker";
import { usePullToRefresh } from "../usePullToRefresh";
import { ReelCard } from "./ReelCard";
import { FeedEnd } from "./FeedEnd";
import { FeedTopBar } from "./FeedTopBar";
import { PullIndicator } from "./PullIndicator";
import { FixationCross } from "./FixationCross";

/** Vertical Reels-style feed: snap-scroll, infinite loading, pull-to-refresh. */
export function FeedList({ visible: tabVisible = true }: { visible?: boolean }) {
  const sessionId = useSessionStore((s) => s.session?.id ?? "");
  // First 30 s of a session = fixation cross (resting EEG baseline); reels play only after it
  const baselinePending = useSessionStore((s) => !!s.session && s.baselineDoneFor !== s.session.id);
  const visible = tabVisible && !baselinePending;
  // Pull-to-refresh moves the start cursor past everything loaded -> fresh reels from the backend
  const [startCursor, setStartCursor] = useState(0);
  const feed = useFeed({ sessionId, startCursor });
  const { mutate: toggleLike } = useToggleLike();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const reels = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);
  const activeReel = reels[activeIndex];

  // Data collection: scroll speed, playback clock (loop), reel views
  const scroll = useScrollTracker(scrollRef, activeIndex, reels.length > 0 && visible);
  useActiveReelTracking(activeReel, activeIndex, {
    enabled: visible, // feed hidden (other tab) = not watching -> the view ends, admin sees "offline"
    getReel: (id) => reels.find((r) => r.id === id),
    takeScrollPeak: scroll.takePeak,
  });

  const scrollTo = useCallback((index: number) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: index * el.clientHeight, behavior: "smooth" });
  }, []);

  const lastCursor = feed.data?.pages.at(-1)?.nextCursor ?? startCursor;
  const onRefresh = useCallback(async () => {
    logEvent("feed_refresh", { value: lastCursor });
    scrollTo(0);
    setStartCursor(lastCursor);
    await new Promise((r) => setTimeout(r, 700));
  }, [lastCursor, scrollTo]);
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
    if (activeIndex >= reels.length - FEED.prefetchWhenLeft && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [activeIndex, reels.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Filter changed / refreshed -> back to the top
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setActiveIndex(0);
  }, [startCursor]);

  // Keyboard: ↑/↓ and j/k
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); scrollTo(Math.min(activeIndex + 1, reels.length)); }
      if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); scrollTo(Math.max(activeIndex - 1, 0)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, reels.length, scrollTo, visible]);

  const handleLike = useCallback(
    (reel: Reel, like: boolean) => {
      logEvent(like ? "reel_like" : "reel_unlike", { reelId: reel.id });
      toggleLike({ reelId: reel.id, like, sessionId });
    },
    [toggleLike, sessionId],
  );

  return (
    <div
      className="relative mx-auto h-dvh w-full max-w-[480px] overflow-hidden bg-black sm:my-0 sm:border-x sm:border-white/10 sm:shadow-[0_0_120px_-20px_rgb(167_139_250/0.35)]"
      // Any tap is a user gesture -> the browser allows sound again
      onPointerDown={() => usePlaybackStore.getState().audioBlocked && usePlaybackStore.getState().setAudioBlocked(false)}
    >
      {baselinePending && <FixationCross visible={tabVisible} />}
      <FeedTopBar onRefresh={() => void ptr.refresh()} refreshing={ptr.refreshing || feed.isPending} />
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
            <ReelCard key={reel.id} reel={reel} index={i} active={i === activeIndex} near={Math.abs(i - activeIndex) <= 1} feedVisible={visible} onLike={handleLike} />
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
