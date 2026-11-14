import type { BrainSnapshot } from "@/types/domain";
import type { StreamStatus } from "@/lib/realtime/types";

/** One stream message = one brain activity snapshot. */
export type EegStreamMessage = BrainSnapshot;

export type EegTransport = "sse" | "ws";

export interface EegStreamOutput {
  data: BrainSnapshot | undefined;
  status: StreamStatus;
  transport: EegTransport;
  /** Messages per second (last 2 s). */
  rateHz: number;
}

/**
 * EEG headset, two ways:
 *  mode "board"  – headset connected in BrainAccess Board, backend listens to its stream (automatic)
 *  mode "direct" – backend connected the headset itself via the BrainAccess SDK (user clicked Connect)
 * States: waiting · connected (Board stream, no data yet) · connecting (direct) · streaming ·
 *         stalled (Board stream without data) · error · disconnected
 */
export type EegState = "waiting" | "connected" | "connecting" | "streaming" | "stalled" | "error" | "disconnected";

export interface EegBoardStream {
  name: string;
  device: string;
  channels: number;
  sampleRate: number;
}

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
  /** All BrainAccess streams Board publishes right now (several headsets -> pick one). */
  available: EegBoardStream[];
  error: string | null;
  /** How to fix it, e.g. allow Bluetooth on macOS. */
  hint: string | null;
  lastDataMsAgo: number | null;
  /** Raw EEG being written to the session folder (eeg_raw.csv). */
  recording: { sessionId: string | null; file: string | null; samples: number } | null;
}

/** POST /api/eeg/scan – headsets advertising nearby (direct mode). Headsets connected in Board are not listed. */
export interface EegScanOutput {
  devices: string[];
  error: string | null;
  hint: string | null;
}

/** POST /api/eeg/baseline/start|finish – resting baseline recorded during the fixation cross. */
export interface EegBaselineOutput {
  /** false = too little clean signal (artifacts / headset off) -> BRI calibrates itself on the first 30 s. */
  ok: boolean;
  cleanSeconds: number;
  /** Resting (theta + alpha) / beta of this person. */
  baselineRatio: number | null;
}
