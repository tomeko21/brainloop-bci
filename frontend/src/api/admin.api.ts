/** Admin panel API: what is being watched right now (heartbeats collected by the backend). */
import type { LiveEventsInput, LiveViewerInput } from "@/types/api/input/useAdmin";
import type { LiveEventsOutput, LiveViewerOutput } from "@/types/api/output/useAdmin";
import { http, query } from "./client";

export function fetchLiveViewer(input: LiveViewerInput): Promise<LiveViewerOutput> {
  return http<LiveViewerOutput>(`/api/live/viewer?${query({ session_id: input.sessionId })}`);
}

export function fetchLiveEvents(input: LiveEventsInput): Promise<LiveEventsOutput> {
  return http<LiveEventsOutput>(`/api/live/events?${query({ session_id: input.sessionId, limit: input.limit })}`);
}
