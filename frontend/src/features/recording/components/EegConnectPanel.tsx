/**
 * EEG headset panel (start screen, Settings, admin): BrainAccess Board stream status (automatic),
 * skin contact + calibration progress, choosing a Board stream, or a direct SDK connection.
 */
import { AnimatePresence, motion } from "motion/react";
import { BatteryMedium, Bluetooth, Brain, ChevronDown, Loader2, Radio, Search, Unplug } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";
import {
  useConnectHeadset, useDisconnectHeadset, useEegStatus, useEegStream, useScanHeadsets, useSelectEegStream,
} from "@/hooks/useEeg";
import { EEG_STATE_LABEL, channelQuality } from "@/lib/eeg";
import { cn } from "@/lib/cn";
import { ELECTRODES } from "@/types/domain";

const HELP: Record<string, string> = {
  waiting: "Connect the headset in BrainAccess Board – it is picked up automatically. No Board? Connect directly below.",
  connected: "Headset found in BrainAccess Board – waiting for the first samples…",
  stalled: "The headset is connected in Board but sends no data. Make sure it shows “Streaming” in Board.",
  connecting: "Connecting over Bluetooth (~10 s)…",
};

/**
 * EEG headset: (1) BrainAccess Board – automatic, or (2) direct connection via the BrainAccess SDK
 * ("Find headsets" -> "Connect"). Nothing scans in the background.
 */
export function EegConnectPanel({ className }: { className?: string }) {
  const { data: s, isError } = useEegStatus();
  const live = useEegStream({ enabled: s?.state === "streaming" });
  const scan = useScanHeadsets();
  const connect = useConnectHeadset();
  const disconnect = useDisconnectHeadset();
  const select = useSelectEegStream();
  const [showDirect, setShowDirect] = useState(false);

  const state = isError ? "offline" : (s?.state ?? "waiting");
  const streaming = state === "streaming";
  const busy = state === "connected" || state === "connecting";
  const direct = s?.mode === "direct";
  const inContact = live.data ? ELECTRODES.filter((e) => channelQuality(live.data, e) === "good").length : null;

  return (
    <div className={cn("glass rounded-ui p-3 text-sm", className)}>
      <div className="flex items-center gap-2">
        <div className={cn("grid size-8 place-items-center rounded-lg", streaming ? "bg-ok/15 text-ok" : "bg-surface-strong text-muted")}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Brain className="size-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            EEG headset {s?.device && <span className="font-mono text-xs text-muted">· {s.device}</span>}
          </p>
          <p className={cn("truncate text-xs", streaming ? "text-ok" : state === "stalled" || state === "error" ? "text-warn" : "text-muted")}>
            {isError
              ? "Backend offline"
              : streaming
                ? `${s?.electrodes ?? "?"} channels · ${s?.sampleRate ?? "?"} Hz · ${direct ? "direct (SDK)" : "via BrainAccess Board"}`
                : (EEG_STATE_LABEL[state] ?? state)}
          </p>
        </div>
        {streaming && s?.battery != null && (
          <span className="flex items-center gap-1 font-mono text-xs text-ok">
            <BatteryMedium className="size-4" /> {s.battery}%
          </span>
        )}
      </div>

      {streaming && (
        <div className="mt-2 space-y-1 text-xs">
          {inContact !== null && (
            <p className={inContact >= 6 ? "text-ok" : "text-warn"}>
              Skin contact: {inContact}/{ELECTRODES.length} electrodes
              {inContact === 0 &&
                (live.data?.saturated === ELECTRODES.length
                  ? " – all channels saturated: the reference/bias electrode (ear clip) is not touching the skin"
                  : " – put the headset on (dry electrodes must touch the scalp)")}
            </p>
          )}
          {live.data?.calibrating && (
            <p className="text-neon-cyan">
              Calibrating BRI to you: {Math.round((live.data.calibrationProgress ?? 0) * 100)}% – sit still for a minute
            </p>
          )}
          <p className="text-muted">
            {s?.recording ? `Recording EEG · ${s.recording.samples.toLocaleString("en-US")} samples` : "EEG is recorded with every session"}
          </p>
        </div>
      )}

      {!streaming && !isError && (
        <>
          {HELP[state] && <p className="mt-2 text-xs text-muted">{HELP[state]}</p>}
          {(s?.hint || (s?.error && state !== "waiting")) && <p className="mt-1 text-xs text-warn">{s?.hint ?? s?.error}</p>}
        </>
      )}

      {/* Several headsets in Board -> pick one */}
      {!direct && (s?.available.length ?? 0) > 1 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs text-muted">Several headsets in Board – choose one:</p>
          {s!.available.map((a) => (
            <div key={a.name} className="flex items-center justify-between rounded-lg bg-surface px-2.5 py-1.5">
              <span className="flex items-center gap-2 font-mono text-xs">
                <Radio className="size-3.5 text-neon-cyan" /> {a.device}
              </span>
              {a.name === s!.stream ? (
                <span className="text-xs text-ok">in use</span>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => select.mutate({ streamName: a.name })}>Use</Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Direct mode controls */}
      {direct ? (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="ghost" loading={disconnect.isPending} onClick={() => disconnect.mutate()}>
            <Unplug className="size-3.5" /> Disconnect
          </Button>
        </div>
      ) : (
        !streaming &&
        !isError && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowDirect((v) => !v)}
              className="flex cursor-pointer items-center gap-1 text-xs text-muted hover:text-fg"
            >
              <ChevronDown className={cn("size-3.5 transition-transform", showDirect && "rotate-180")} />
              Connect directly (without BrainAccess Board)
            </button>
            <AnimatePresence>
              {showDirect && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                  <p className="mt-2 text-xs text-muted">
                    Turn the headset on. A headset connected in Board is invisible here – disconnect it in Board first.
                  </p>
                  <Button size="sm" variant="secondary" className="mt-2" loading={scan.isPending} onClick={() => scan.mutate()}>
                    <Search className="size-3.5" /> {scan.isPending ? "Searching (~5 s)…" : "Find headsets"}
                  </Button>
                  {scan.data && (
                    <div className="mt-2 space-y-1.5">
                      {scan.data.devices.length === 0 ? (
                        <p className="text-xs text-muted">{scan.data.hint ?? scan.data.error ?? "No free headset found nearby."}</p>
                      ) : (
                        scan.data.devices.map((name) => (
                          <div key={name} className="flex items-center justify-between rounded-lg bg-surface px-2.5 py-1.5">
                            <span className="flex items-center gap-2 font-mono text-xs">
                              <Bluetooth className="size-3.5 text-neon-cyan" /> {name}
                            </span>
                            <Button size="sm" variant="secondary" loading={connect.isPending} onClick={() => connect.mutate({ deviceName: name })}>
                              Connect
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      )}
    </div>
  );
}
