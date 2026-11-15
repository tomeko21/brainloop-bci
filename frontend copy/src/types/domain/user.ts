export type UserRole = "subject" | "admin";

export interface UserProfile {
  subjectName: string;
  role: UserRole;
  deviceId: string;
  joinedAt: string;
  avatarHue: number;
}

export interface UserStats {
  reelsWatched: number;
  likesGiven: number;
  avgWatchTimeSec: number;
  totalSessionTimeSec: number;
  avgFatigue: number;  // mean AI BRI / 100
  focusTrend: number[];  // last 12 windows, for the sparkline
}
