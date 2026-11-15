import type { BrainSnapshot } from "@/types/domain";
import type { StreamStatus } from "@/lib/realtime/types";

export type EegStreamMessage = BrainSnapshot;

export type EegTransport = "sse" | "ws";

export interface EegStreamOutput {
  data: BrainSnapshot | undefined;
  status: StreamStatus;
  transport: EegTransport;
  rateHz: number;  // messages per second over the last 2 s
}

export type EegState = "waiting" | "connected" | "connecting" | "streaming" | "stalled" | "error" | "disconnected";

export interface EegBoardStream {
  name: string;
  device: string;
  channels: number;
  sampleRate: number;
}

// GET /api/eeg/status. board = backend listens to BrainAccess Board, direct = backend connected via the SDK
export interface EegStatusOutput {
  source: "brainaccess" | string;
  mode: "board" | "direct";
  state: EegState | string;
  device: string | null;
  stream: string | null;
  battery: number | null;
  sampleRate: number | null;
  electrodes: number | null;
  hasAccel: boolean | null;
  channelNames: string[];
  available: EegBoardStream[];  // all streams Board publishes, pick one if there are several
  error: string | null;
  hint: string | null;  // how to fix it, e.g. allow Bluetooth on macOS
  lastDataMsAgo: number | null;
  recording: { sessionId: string | null; file: string | null; samples: number } | null;  // raw EEG being written to eeg_raw.csv
}

// POST /api/eeg/scan, headsets already connected in Board are not listed
export interface EegScanOutput {
  devices: string[];
  error: string | null;
  hint: string | null;
}

export interface EegBaselineOutput {
  ok: boolean;  // false = too little clean signal, BRI then calibrates on the first 30 s
  cleanSeconds: number;
  baselineRatio: number | null;  // resting (theta + alpha) / beta
}
