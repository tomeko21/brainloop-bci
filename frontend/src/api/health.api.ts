/** Backend health: DB, number of reels, EEG source and model version. */
import type { HealthOutput } from "@/types/api/output/useHealth";
import { http } from "./client";

export function fetchHealth(): Promise<HealthOutput> {
  return http<HealthOutput>("/api/health");
}
