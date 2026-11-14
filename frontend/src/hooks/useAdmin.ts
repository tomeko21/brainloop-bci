import { useQuery } from "@tanstack/react-query";
import { fetchLiveViewer } from "@/api/admin.api";
import type { LiveViewerInput } from "@/types/api/input/useAdmin";
import type { LiveViewerOutput } from "@/types/api/output/useAdmin";
import { queryKeys } from "./queryKeys";

/** Polling every 1 s: which reel (and at which position) the other device is watching now. */
export function useLiveViewer({ sessionId }: LiveViewerInput = {}) {
  return useQuery<LiveViewerOutput>({
    queryKey: queryKeys.liveViewer(sessionId),
    queryFn: () => fetchLiveViewer({ sessionId }),
    refetchInterval: 1_000,
    refetchIntervalInBackground: true,
  });
}
