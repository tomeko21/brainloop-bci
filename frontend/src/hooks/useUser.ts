import { useQuery } from "@tanstack/react-query";
import { fetchUserProfile, fetchUserStats } from "@/api/user.api";
import type { UserProfileInput, UserStatsInput } from "@/types/api/input/useUser";
import type { UserProfileOutput, UserStatsOutput } from "@/types/api/output/useUser";
import { queryKeys } from "./queryKeys";

export function useUserProfile({ subjectName }: UserProfileInput) {
  return useQuery<UserProfileOutput>({
    queryKey: queryKeys.userProfile(subjectName),
    queryFn: () => fetchUserProfile({ subjectName }),
    enabled: subjectName.length > 0,
    staleTime: 5 * 60_000,
  });
}

export function useUserStats({ subjectName }: UserStatsInput) {
  return useQuery<UserStatsOutput>({
    queryKey: queryKeys.userStats(subjectName),
    queryFn: () => fetchUserStats({ subjectName }),
    enabled: subjectName.length > 0,
    staleTime: 30_000,
  });
}
