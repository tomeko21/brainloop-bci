import { useEffect, useLayoutEffect, useRef } from "react";
import { TRACKING } from "@/config/tracking";
import { useReportActiveReel } from "@/hooks/useFeed";
import { logEvent } from "@/store/csvLogStore";
import { useFaceStore } from "@/store/faceStore";
import { useMlStore } from "@/store/mlStore";
import { playbackSnapshot, usePlaybackStore } from "@/store/playbackStore";
import { useSessionStore } from "@/store/sessionStore";
import { reelViewsTable } from "@/services/dataLogger/tables";
import { timeOrigin } from "@/lib/timebase";
import { saveUnsavedNow } from "@/services/storage/tableAutosave";
import type { Reel } from "@/types/domain";
import type { ReportActiveReelInput } from "@/types/api/input/useFeed";

interface Options {
  /** Latest version of the reel (e.g. like state) at the moment of leaving. */
  getReel: (id: string) => Reel | undefined;
  /** Peak scroll speed since the last call. */
  takeScrollPeak: () => number;
}

/**
 * For the currently visible reel:
 *  - events.csv: reel_view_start / reel_view_end,
 *  - reel_views.csv: time on reel, % watched, loops, pauses, like, scroll speed on exit,
 *  - heartbeat to the API (admin panel sees the reel + playback position + face summary).
 */
export function useActiveReelTracking(reel: Reel | undefined, index: number, opts: Options) {
  const session = useSessionStore((s) => s.session);
  const { mutate: report } = useReportActiveReel();
  const indexRef = useRef(index);
  const optsRef = useRef(opts);
  // Layout effect runs BEFORE the cleanup of the effect below -> cleanup already knows the new index (exit direction)
  useLayoutEffect(() => {
    indexRef.current = index;
    optsRef.current = opts;
  });
  const lastSent = useRef<ReportActiveReelInput | null>(null);

  // Leaving the feed (e.g. to settings) -> admin immediately sees "offline"
  useEffect(() => () => {
    if (lastSent.current) report({ ...lastSent.current, left: true });
  }, [report]);

  useEffect(() => {
    if (!reel || !session) return;
    const startedAt = Date.now();
    opts.takeScrollPeak(); // reset the peak – we only count movement that leaves this reel
    logEvent("reel_view_start", { reelId: reel.id, tsMs: startedAt, value: index });

    let viewFinished = false;
    /** Write a reel_views row (once per view). */
    const finishView = (forcedExit?: string) => {
      if (viewFinished) return;
      viewFinished = true;
      const end = Date.now();
      const pb = usePlaybackStore.getState();
      const played = pb.reelId === reel.id ? pb.playedMs : 0;
      const durationMs = reel.durationSec * 1000;
      const nextIndex = indexRef.current;
      const origin = timeOrigin(startedAt);
      const latest = optsRef.current.getReel(reel.id) ?? reel;

      logEvent("reel_view_end", { reelId: reel.id, tsMs: end, value: end - startedAt });
      reelViewsTable.append({
        session_id: session.id,
        reel_id: reel.id,
        reel_index: index,
        mood: reel.mood,
        view_start_ms: startedAt,
        view_end_ms: end,
        t_rel_start_ms: startedAt - origin,
        t_rel_end_ms: end - origin,
        dwell_ms: end - startedAt,
        played_ms: Math.round(played),
        duration_ms: durationMs,
        watch_pct: Number(((played / durationMs) * 100).toFixed(1)),
        completed_loops: Math.floor(played / durationMs),
        pause_count: pb.reelId === reel.id ? pb.pauseCount : 0,
        liked: latest.likedByMe ? 1 : 0,
        exit_direction: forcedExit ?? (nextIndex > index ? "next" : nextIndex < index ? "prev" : "end"),
        exit_scroll_speed_reels_s: Number(optsRef.current.takeScrollPeak().toFixed(3)),
      });
    };

    let leaving = false;
    const send = (left = false) => {
      // After pagehide the browser still sends visibilitychange – don't overwrite "left"
      if (leaving && !left) return;
      const payload: ReportActiveReelInput = {
        sessionId: session.id,
        subjectName: session.subjectName,
        reelId: reel.id,
        reelIndex: index,
        playback: playbackSnapshot(),
        visible: document.visibilityState === "visible",
        left,
        face: useFaceStore.getState().summary,
        prediction: useMlStore.getState().prediction,
      };
      lastSent.current = payload;
      report(payload);
    };

    send();
    const id = window.setInterval(() => send(), TRACKING.heartbeatMs);
    const onVisibility = () => send();
    const onPageHide = () => {
      send(true);
      leaving = true;
      finishView("page_exit"); // reload / tab close – save the view immediately
      saveUnsavedNow();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return; // back from bfcache -> watching again
      leaving = false;
      send();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    // Pause / resume -> immediate heartbeat so admin sees it right away
    const unsubPause = usePlaybackStore.subscribe((s, prev) => s.paused !== prev.paused && send());

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      unsubPause();

      finishView();
    };
  }, [reel?.id, index, session, report]); // eslint-disable-line react-hooks/exhaustive-deps
}
