/** Users API (no accounts – a user is just a subject name). */
import type { UserProfileInput, UserStatsInput } from "@/types/api/input/useUser";
import type { UserProfileOutput, UserStatsOutput } from "@/types/api/output/useUser";
import { http } from "./client";

export function fetchUserProfile(input: UserProfileInput): Promise<UserProfileOutput> {
  return http<UserProfileOutput>(`/api/users/${encodeURIComponent(input.subjectName)}`);
}

export function fetchUserStats(input: UserStatsInput): Promise<UserStatsOutput> {
  return http<UserStatsOutput>(`/api/users/${encodeURIComponent(input.subjectName)}/stats`);
}
