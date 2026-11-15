export interface HealthOutput {
  status: "ok" | "degraded";
  db: boolean;
  reels: number;
  activeReels: number;
  modelVersion: string;
}
