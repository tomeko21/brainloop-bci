import type { FeedPageInput } from "@/types/api/input/useFeed";

// all React Query keys in one place
export const queryKeys = {
  feed: (sessionId: FeedPageInput["sessionId"], startCursor: number) => ["feed", sessionId, { startCursor }] as const,
  feedAll: ["feed"] as const,
  userProfile: (subjectName: string) => ["user", subjectName, "profile"] as const,
  userStats: (subjectName: string) => ["user", subjectName, "stats"] as const,
  liveEvents: (sessionId?: string) => ["admin", "live-events", sessionId ?? "latest"] as const,
  liveViewer: (sessionId?: string) => ["admin", "live-viewer", sessionId ?? "latest"] as const,
  health: ["health"] as const,
  storageStatus: ["session", "storage-status"] as const,
  eegStatus: ["eeg", "status"] as const,
  eegLive: (sessionId?: string) => ["eeg", "live", sessionId ?? "latest"] as const,
};
