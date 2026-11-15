import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "@/api/health.api";
import type { HealthOutput } from "@/types/api/output/useHealth";
import { queryKeys } from "./queryKeys";

export function useHealth() {
  return useQuery<HealthOutput>({
    queryKey: queryKeys.health,
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    retry: false,
  });
}
