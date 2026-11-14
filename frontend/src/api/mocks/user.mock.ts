/**
 * ============================================================
 *  MOCK PROFILE AND STATS – to be replaced by GET /api/users/...
 * ============================================================
 */
import type { UserProfile, UserStats } from "@/types/domain";
import { seeded } from "./random";

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function mockUserProfile(subjectName: string): UserProfile {
  const r = seeded(hash(subjectName));
  return {
    subjectName,
    role: subjectName.toLowerCase() === "admin" ? "admin" : "subject",
    deviceId: `dev-${hash(subjectName).toString(16).slice(0, 6)}`,
    joinedAt: new Date(Date.now() - Math.floor(r() * 14) * 86_400_000).toISOString(),
    avatarHue: Math.floor(r() * 360),
  };
}

export function mockUserStats(subjectName: string): UserStats {
  const r = seeded(hash(subjectName) + 99);
  return {
    reelsWatched: 40 + Math.floor(r() * 400),
    likesGiven: 5 + Math.floor(r() * 80),
    avgWatchTimeSec: 4 + Math.round(r() * 120) / 10,
    totalSessionTimeSec: 600 + Math.floor(r() * 7200),
    avgFatigue: Math.round((0.2 + r() * 0.6) * 100) / 100,
    focusTrend: Array.from({ length: 12 }, (_, i) =>
      Math.max(0.05, Math.min(1, 0.85 - i * 0.04 + (r() - 0.5) * 0.25)),
    ),
  };
}
