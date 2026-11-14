import type { FeedPageInput } from "@/types/api/input/useFeed";

/** Single source of truth for React Query keys. */
export const queryKeys = {
  feed: (calmFilter: FeedPageInput["calmFilter"]) => ["feed", { calmFilter }] as const,
  feedAll: ["feed"] as const,
  userProfile: (subjectName: string) => ["user", subjectName, "profile"] as const,
  userStats: (subjectName: string) => ["user", subjectName, "stats"] as const,
  liveViewer: (sessionId?: string) => ["admin", "live-viewer", sessionId ?? "latest"] as const,
  storageStatus: ["session", "storage-status"] as const,
  eegLive: (sessionId?: string) => ["eeg", "live", sessionId ?? "latest"] as const,
};
