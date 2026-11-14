/**
 * User API (no accounts – identified by `subjectName` alone).
 * ⚠️ MOCK: profile and stats generated deterministically from the name.
 */
import type { UserProfileInput, UserStatsInput } from "@/types/api/input/useUser";
import type { UserProfileOutput, UserStatsOutput } from "@/types/api/output/useUser";
import { USE_MOCKS, http, mockDelay } from "./client";
import { mockUserProfile, mockUserStats } from "./mocks/user.mock";

export async function fetchUserProfile(input: UserProfileInput): Promise<UserProfileOutput> {
  if (!USE_MOCKS) return http<UserProfileOutput>(`/api/users/${encodeURIComponent(input.subjectName)}`);
  await mockDelay(); // --- MOCK ---
  return mockUserProfile(input.subjectName);
}

export async function fetchUserStats(input: UserStatsInput): Promise<UserStatsOutput> {
  if (!USE_MOCKS) return http<UserStatsOutput>(`/api/users/${encodeURIComponent(input.subjectName)}/stats`);
  await mockDelay(400, 900); // --- MOCK ---
  return mockUserStats(input.subjectName);
}
