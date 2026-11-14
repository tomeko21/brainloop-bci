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
  /** Mean fatigue indicator 0..1 over recent sessions (mock). */
  avgFatigue: number;
  /** Focus indicator from the last 12 windows (for the mini chart). */
  focusTrend: number[];
}
