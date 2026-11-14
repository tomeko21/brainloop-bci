/**
 * EEG headset: BrainAccess Board stream (automatic) or a direct SDK connection (scan + connect).
 * Live snapshots: SSE by default, WebSocket with VITE_EEG_TRANSPORT=ws. No data = no messages.
 */
import type { EegBaselineInput, EegConnectInput, EegSelectInput, EegStreamInput } from "@/types/api/input/useEeg";
import type { EegBaselineOutput, EegScanOutput, EegStatusOutput, EegStreamMessage, EegTransport } from "@/types/api/output/useEeg";
import { connectSse } from "@/lib/realtime/sse";
import { connectWs } from "@/lib/realtime/ws";
import type { StreamCallbacks, StreamHandle } from "@/lib/realtime/types";
import { API_BASE_URL, http, query, wsUrl } from "./client";

export const EEG_TRANSPORT: EegTransport = import.meta.env.VITE_EEG_TRANSPORT ?? "sse";

export function subscribeEegStream(input: EegStreamInput, cb: StreamCallbacks<EegStreamMessage>): StreamHandle {
  const q = query({ session_id: input.sessionId });
  return EEG_TRANSPORT === "ws"
    ? connectWs(wsUrl(`/ws/eeg/live?${q}`), cb)
    : connectSse(`${API_BASE_URL}/api/eeg/stream?${q}`, cb);
}

/** Is the headset connected / streaming / recording? */
export function fetchEegStatus(): Promise<EegStatusOutput> {
  return http<EegStatusOutput>("/api/eeg/status");
}

/** Use this BrainAccess Board stream (only needed when several headsets are connected in Board). */
export function selectEegStream(input: EegSelectInput): Promise<EegStatusOutput> {
  return http<EegStatusOutput>("/api/eeg/select", { method: "POST", body: input });
}

/** Direct mode: one Bluetooth scan on the backend (~5 s). */
export function scanHeadsets(): Promise<EegScanOutput> {
  return http<EegScanOutput>("/api/eeg/scan", { method: "POST" });
}

/** Direct mode: connect to this headset via the BrainAccess SDK (Board listening pauses). */
export function connectHeadset(input: EegConnectInput): Promise<EegStatusOutput> {
  return http<EegStatusOutput>("/api/eeg/connect", { method: "POST", body: input });
}

/** End the direct connection – back to listening to BrainAccess Board. */
export function disconnectHeadset(): Promise<EegStatusOutput> {
  return http<EegStatusOutput>("/api/eeg/disconnect", { method: "POST" });
}

/** Fixation cross: "start" = begin collecting the resting EEG baseline, "finish" = compute it. */
export function eegBaseline(step: EegBaselineInput): Promise<EegBaselineOutput> {
  return http<EegBaselineOutput>(`/api/eeg/baseline/${step}`, { method: "POST" });
}
