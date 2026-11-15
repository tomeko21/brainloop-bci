import { useQuery } from "@tanstack/react-query";
import { fetchLiveEvents, fetchLiveViewer } from "@/api/admin.api";
import type { LiveEventsInput, LiveViewerInput } from "@/types/api/input/useAdmin";
import type { LiveEventsOutput, LiveViewerOutput } from "@/types/api/output/useAdmin";
import { queryKeys } from "./queryKeys";

// Admin panel polling, the data comes from feed heartbeats.
export function useLiveViewer({ sessionId }: LiveViewerInput = {}) {
  return useQuery<LiveViewerOutput>({
    queryKey: queryKeys.liveViewer(sessionId),
    queryFn: () => fetchLiveViewer({ sessionId }),
    refetchInterval: 1_000,
    refetchIntervalInBackground: true,
  });
}

export function useLiveEvents({ sessionId, limit = 14 }: LiveEventsInput = {}) {
  return useQuery<LiveEventsOutput>({
    queryKey: queryKeys.liveEvents(sessionId),
    queryFn: () => fetchLiveEvents({ sessionId, limit }),
    refetchInterval: 2_000,
    refetchIntervalInBackground: true,
  });
}
