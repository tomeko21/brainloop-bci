/** Reel mood – derived by the backend from the dataset's stim_level (low/medium/high). */
export type ReelMood = "calm" | "neutral" | "intense";

/** Stimulation metrics computed for each video in the dataset (seed/reels_metadata.csv). */
export interface ReelMetrics {
  cutsPerSec: number;
  motionScore: number;
  flashesPerSec: number;
  objectiveStimScore: number;
  /** hybrid_brainrot_score from the dataset (~1.5 calm … 9 hardcore brainrot). */
  brainrotScore: number;
}

export interface Reel {
  id: string;
  author: {
    handle: string;
    avatarHue: number;
    verified: boolean;
  };
  caption: string;
  tags: string[];
  durationSec: number;
  /** Two gradient hues shown behind the video (letterbox + while loading). */
  palette: [number, number];
  mood: ReelMood;
  likes: number;
  comments: number;
  likedByMe: boolean;
  createdAt: string;
  /** Path served by the backend, e.g. /media/videos/slow_nature/slow_nature_002.mp4 */
  videoUrl: string;
  category: string;
  stimLevel: "low" | "medium" | "high" | string;
  metrics: ReelMetrics;
}
