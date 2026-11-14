import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "@/api/health.api";
import type { HealthOutput } from "@/types/api/output/useHealth";
import { queryKeys } from "./queryKeys";

/** Backend status (DB, reels, EEG source, model) – refreshed every 30 s. */
export function useHealth() {
  return useQuery<HealthOutput>({
    queryKey: queryKeys.health,
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    retry: false,
  });
}
