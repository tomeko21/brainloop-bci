// SSE /api/eeg/stream or WS /ws/eeg/live
export interface EegStreamInput {
  sessionId?: string;
  enabled?: boolean;
}

export type EegStatusInput = void;

// POST /api/eeg/select, when several headsets are connected in Board
export interface EegSelectInput {
  streamName: string;
}

// POST /api/eeg/connect
export interface EegConnectInput {
  deviceName: string;  // exact advertised name, e.g. "BA MINI 074"
}

// POST /api/eeg/baseline/{start|finish}
export type EegBaselineInput = "start" | "finish";
