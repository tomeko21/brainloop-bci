// BrainAccess headset: Board stream (automatic) or a direct SDK connection. Live snapshots over SSE,
// or WebSocket with VITE_EEG_TRANSPORT=ws. No headset data means no messages.
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

export function fetchEegStatus(): Promise<EegStatusOutput> {
  return http<EegStatusOutput>("/api/eeg/status");
}

export function selectEegStream(input: EegSelectInput): Promise<EegStatusOutput> {
  return http<EegStatusOutput>("/api/eeg/select", { method: "POST", body: input });
}

// Bluetooth scan on the backend, takes ~5 s
export function scanHeadsets(): Promise<EegScanOutput> {
  return http<EegScanOutput>("/api/eeg/scan", { method: "POST" });
}

// Board listening pauses while connected directly
export function connectHeadset(input: EegConnectInput): Promise<EegStatusOutput> {
  return http<EegStatusOutput>("/api/eeg/connect", { method: "POST", body: input });
}

export function disconnectHeadset(): Promise<EegStatusOutput> {
  return http<EegStatusOutput>("/api/eeg/disconnect", { method: "POST" });
}

// start when the fixation cross appears, finish computes the resting baseline
export function eegBaseline(step: EegBaselineInput): Promise<EegBaselineOutput> {
  return http<EegBaselineOutput>(`/api/eeg/baseline/${step}`, { method: "POST" });
}
