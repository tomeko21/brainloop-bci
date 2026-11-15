// Per-reel view tracking: events.csv, reel_views.csv and the heartbeat behind the admin live view.
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

// module level so it survives reel changes
let lastSentEventTs = 0;

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
  enabled: boolean;
  getReel: (id: string) => Reel | undefined;
  takeScrollPeak: () => number;
}

export function useActiveReelTracking(reel: Reel | undefined, index: number, opts: Options) {
  const session = useSessionStore((s) => s.session);
  const { mutate: report } = useReportActiveReel();
  const indexRef = useRef(index);
  const optsRef = useRef(opts);
  // runs before the cleanup below, so the cleanup already sees the new index (exit direction)
  useLayoutEffect(() => {
    indexRef.current = index;
    optsRef.current = opts;
  });
  const lastSent = useRef<ReportActiveReelInput | null>(null);

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
    opts.takeScrollPeak(); // only count movement that leaves this reel
    logEvent("reel_view_start", { reelId: reel.id, tsMs: startedAt, value: index });

    let viewFinished = false;
    const finishView = (forcedExit?: string) => {
      if (viewFinished) return;
      viewFinished = true;
      const end = Date.now();
      const pb = usePlaybackStore.getState();
      const mine = pb.reelId === reel.id;
      const played = mine ? pb.playedMs : 0;
      // falls back to the dataset duration if the video never loaded
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
      // browsers still fire visibilitychange after pagehide, keep "left"
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
      finishView("page_exit");
      saveUnsavedNow();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return; // back from bfcache
      leaving = false;
      send();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
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
