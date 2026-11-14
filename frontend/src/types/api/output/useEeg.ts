import type { BrainSnapshot } from "@/types/domain";
import type { StreamStatus } from "@/lib/realtime/types";

/** One stream message = one brain activity snapshot. */
export type EegStreamMessage = BrainSnapshot;

export type EegTransport = "mock" | "sse" | "ws";

export interface EegStreamOutput {
  data: BrainSnapshot | undefined;
  status: StreamStatus;
  transport: EegTransport;
  /** Messages per second (last 2 s). */
  rateHz: number;
}
