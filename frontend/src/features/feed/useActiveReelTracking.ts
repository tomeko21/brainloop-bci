/**
 * Tracks the reel currently on screen: events (view start/end), reel_views.csv rows
 * (time on reel, % watched, loops, pauses, like, scroll speed on exit) and the heartbeat to the backend
 * (admin live view: reel, playback position, face summary, prediction, calm filter, new events).
 */
import { useEffect, useLayoutEffect, useRef } from "react";
import { TRACKING } from "@/config/tracking";
import { useReportActiveReel } from "@/hooks/useFeed";
import { logEvent } from "@/store/csvLogStore";
import { useFaceStore } from "@/store/faceStore";
import { useMlStore } from "@/store/mlStore";
import { useCalmStore } from "@/store/calmStore";
import { playbackSnapshot, usePlaybackStore } from "@/store/playbackStore";
import { useSessionStore } from "@/store/sessionStore";
import { reelViewsTable } from "@/services/dataLogger/tables";
import { timeOrigin } from "@/lib/timebase";
import { saveUnsavedNow } from "@/services/storage/tableAutosave";
import type { Reel } from "@/types/domain";
import type { LiveEventRow, ReportActiveReelInput } from "@/types/api/input/useFeed";
import { useCsvLogStore } from "@/store/csvLogStore";

/** Timestamp of the newest event already sent with a heartbeat (module-level: survives reel changes). */
let lastSentEventTs = 0;

/** events.csv rows of this session logged since the previous heartbeat. */
function takeNewEvents(sessionId: string): LiveEventRow[] {
  const rows = useCsvLogStore.getState().rows;
  const fresh: LiveEventRow[] = [];
  for (let i = rows.length - 1; i >= 0 && rows[i].tsMs > lastSentEventTs; i--) {
    if (rows[i].sessionId === sessionId) fresh.push(rows[i]);
  }
  if (rows.length) lastSentEventTs = Math.max(lastSentEventTs, rows[rows.length - 1].tsMs);
  return fresh.reverse();
}

interface Options {
  /** Feed visible – when false the current view ends and the admin sees the viewer as offline. */
  enabled: boolean;
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

  // Leaving the feed (another tab / end of session) -> admin immediately sees "offline"
  const enabled = opts.enabled;
  useEffect(() => {
    if (!enabled) return;
    return () => {
      if (lastSent.current) report({ ...lastSent.current, left: true, events: [] });
    };
  }, [enabled, report]);

  useEffect(() => {
    if (!reel || !session || !enabled) return;
    const startedAt = Date.now();
    usePlaybackStore.getState().reset(reel.id, reel.durationSec * 1000);
    opts.takeScrollPeak(); // reset the peak – we only count movement that leaves this reel
    logEvent("reel_view_start", { reelId: reel.id, tsMs: startedAt, value: index });

    let viewFinished = false;
    /** Write a reel_views row (once per view). */
    const finishView = (forcedExit?: string) => {
      if (viewFinished) return;
      viewFinished = true;
      const end = Date.now();
      const pb = usePlaybackStore.getState();
      const mine = pb.reelId === reel.id;
      const played = mine ? pb.playedMs : 0;
      // Real video duration (falls back to the dataset's value if the video never loaded)
      const durationMs = mine && pb.durationMs > 1 ? Math.round(pb.durationMs) : Math.round(reel.durationSec * 1000);
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
        completed_loops: mine ? pb.loops : 0,
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
        events: takeNewEvents(session.id),
        calmIntensity: Math.round(useCalmStore.getState().intensity * 100) / 100,
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
  }, [reel?.id, index, session, report, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
