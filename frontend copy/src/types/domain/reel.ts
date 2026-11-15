// derived by the backend from the dataset stim_level
export type ReelMood = "calm" | "neutral" | "intense";

// per-video stimulation metrics from seed/reels_metadata.csv
export interface ReelMetrics {
  cutsPerSec: number;
  motionScore: number;
  flashesPerSec: number;
  objectiveStimScore: number;
  brainrotScore: number;  // ~1.5 calm up to 9 hardcore
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
  palette: [number, number];  // two gradient hues shown behind the video
  mood: ReelMood;
  likes: number;
  comments: number;
  likedByMe: boolean;
  createdAt: string;
  videoUrl: string;  // served by the backend under /media/videos/
  category: string;
  stimLevel: "low" | "medium" | "high" | string;
  metrics: ReelMetrics;
}
