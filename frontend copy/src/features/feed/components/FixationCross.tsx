// Fixation cross before the first reel. Backend records a resting baseline (/api/eeg/baseline/start, /finish)
// and later BRI values are relative to it. Hiding the tab restarts it.
import { useEffect, useRef, useState } from "react";
import { BASELINE } from "@/config/tuning";
import { useEegBaseline, useEegStatus } from "@/hooks/useEeg";
import { brainrotBaseline } from "@/services/brainrot/brainrotClient";
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
    // brainrot model baseline runs even without EEG, camera alone is enough
    brainrotBaseline("start").catch(() => setNote("Could not reach the backend – baseline skipped."));

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
      const bri = brainrotBaseline("finish")
        .then((r) => `bri_${r.ok ? "ok" : "too_little_data"};windows=${r.windows ?? 0}`)
        .catch(() => "bri_backend_error");
      if (!eegStreaming) return void bri.then((b) => done(`no_eeg;${b}`));
      baseline("finish")
        .then(async (r) => done(`${r.ok ? `ok;clean_s=${r.cleanSeconds}` : `too_noisy;clean_s=${r.cleanSeconds}`};${await bri}`))
        .catch(async () => done(`backend_error;${await bri}`));
    }, 100);

    return () => {
      window.clearInterval(id);
      // aborted early, still finish so BRI doesn't stay hidden in "collecting" mode
      if (!finished.current) {
        logEvent("baseline_abort", { value: Math.round(performance.now() - startedAt) });
        brainrotBaseline("finish").catch(() => {});
      }
    };
  // eegStreaming flipping mid-way restarts the baseline on purpose
  }, [visible, sessionId, eegStreaming, baseline, setDone]);

  const left = Math.max(0, Math.ceil((BASELINE.durationMs - elapsedMs) / 1000));
  const progress = Math.min(1, elapsedMs / BASELINE.durationMs);

  return (
    <div className="absolute inset-0 z-40 select-none" style={{ background: BASELINE.background }}>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-label="Fixation cross">
        <div className="absolute left-1/2 top-1/2 h-1.5 w-14 -translate-x-1/2 -translate-y-1/2" style={{ background: BASELINE.crossColor }} />
        <div className="absolute left-1/2 top-1/2 h-14 w-1.5 -translate-x-1/2 -translate-y-1/2" style={{ background: BASELINE.crossColor }} />
      </div>

      <div className="absolute inset-x-0 bottom-24 px-6 text-center text-black/60">
        <p className="text-sm font-medium">Relax and look at the cross</p>
        <p className="mt-1 font-mono text-xs tabular-nums">{left}s · {eegStreaming ? "recording your resting EEG + face" : "camera only (no EEG headset)"}</p>
        {note && <p className="mt-1 text-xs">{note}</p>}
        <div className="mx-auto mt-3 h-1 w-40 overflow-hidden rounded-full bg-black/15">
          <div className="h-full bg-black/50" style={{ width: `${progress * 100}%` }} />
        </div>
        {!eegStreaming && BASELINE.allowSkipWithoutHeadset && sessionId && (
          <button
            type="button"
            onClick={() => {
              finished.current = true;
              brainrotBaseline("finish").catch(() => {});
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
