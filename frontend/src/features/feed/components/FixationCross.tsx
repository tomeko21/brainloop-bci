/**
 * First "reel" of every session: 30 s fixation cross = resting EEG baseline.
 *
 * The person relaxes and looks at the cross; the backend collects artifact-free EEG during this time
 * (POST /api/eeg/baseline/start … /finish) and every later BRI is relative to it (25 = at rest).
 * Reels start only after the cross. If the tab is hidden meanwhile, the baseline starts over
 * (the person was not looking at the cross).
 */
import { useEffect, useRef, useState } from "react";
import { BASELINE } from "@/config/tuning";
import { useEegBaseline, useEegStatus } from "@/hooks/useEeg";
import { logEvent } from "@/store/csvLogStore";
import { useSessionStore } from "@/store/sessionStore";

export function FixationCross({ visible }: { visible: boolean }) {
  const sessionId = useSessionStore((s) => s.session?.id);
  const setDone = useSessionStore((s) => s.setBaselineDone);
  const eegStreaming = useEegStatus().data?.state === "streaming";
  const { mutateAsync: baseline } = useEegBaseline();
  const [elapsedMs, setElapsedMs] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const finished = useRef(false);

  useEffect(() => {
    if (!visible || !sessionId) return;
    finished.current = false;
    const startedAt = performance.now();
    setElapsedMs(0);
    logEvent("baseline_start", { value: eegStreaming ? "eeg" : "no_eeg" });
    if (eegStreaming) baseline("start").catch(() => setNote("Could not reach the backend – baseline skipped."));

    const id = window.setInterval(() => {
      const t = performance.now() - startedAt;
      setElapsedMs(t);
      if (t < BASELINE.durationMs || finished.current) return;
      finished.current = true;
      window.clearInterval(id);
      const done = (value: string) => {
        logEvent("baseline_end", { value });
        setDone(sessionId);
      };
      if (!eegStreaming) return done("no_eeg");
      baseline("finish")
        .then((r) => done(r.ok ? `ok;clean_s=${r.cleanSeconds}` : `too_noisy;clean_s=${r.cleanSeconds}`))
        .catch(() => done("backend_error"));
    }, 100);

    return () => {
      window.clearInterval(id);
      if (!finished.current) logEvent("baseline_abort", { value: Math.round(performance.now() - startedAt) });
    };
    // eegStreaming changing mid-way (headset connected) restarts the baseline – intended
  }, [visible, sessionId, eegStreaming, baseline, setDone]);

  const left = Math.max(0, Math.ceil((BASELINE.durationMs - elapsedMs) / 1000));
  const progress = Math.min(1, elapsedMs / BASELINE.durationMs);

  return (
    <div className="absolute inset-0 z-40 select-none" style={{ background: BASELINE.background }}>
      {/* The cross – nothing else moves near it */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-label="Fixation cross">
        <div className="absolute left-1/2 top-1/2 h-1.5 w-14 -translate-x-1/2 -translate-y-1/2" style={{ background: BASELINE.crossColor }} />
        <div className="absolute left-1/2 top-1/2 h-14 w-1.5 -translate-x-1/2 -translate-y-1/2" style={{ background: BASELINE.crossColor }} />
      </div>

      {/* Above the bottom tab bar */}
      <div className="absolute inset-x-0 bottom-24 px-6 text-center text-black/60">
        <p className="text-sm font-medium">Relax and look at the cross</p>
        <p className="mt-1 font-mono text-xs tabular-nums">{left}s · {eegStreaming ? "recording your resting EEG" : "no EEG headset"}</p>
        {note && <p className="mt-1 text-xs">{note}</p>}
        <div className="mx-auto mt-3 h-1 w-40 overflow-hidden rounded-full bg-black/15">
          <div className="h-full bg-black/50" style={{ width: `${progress * 100}%` }} />
        </div>
        {!eegStreaming && BASELINE.allowSkipWithoutHeadset && sessionId && (
          <button
            type="button"
            onClick={() => {
              finished.current = true;
              logEvent("baseline_end", { value: "skipped" });
              setDone(sessionId);
            }}
            className="mt-4 cursor-pointer rounded-full bg-black/10 px-4 py-1.5 text-xs font-medium text-black/70 hover:bg-black/20"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
