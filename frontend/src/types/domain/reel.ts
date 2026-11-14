/** Reel mood category – the calm filter prefers "calm". */
export type ReelMood = "calm" | "neutral" | "intense";

export interface Reel {
  id: string;
  author: {
    handle: string;
    avatarHue: number;
    verified: boolean;
  };
  caption: string;
  tags: string[];
  /** Duration of the fake video in seconds. */
  durationSec: number;
  /** Two gradient hues (HSL hue) used to "paint" the fake video. */
  palette: [number, number];
  mood: ReelMood;
  likes: number;
  comments: number;
  likedByMe: boolean;
  createdAt: string;
}
