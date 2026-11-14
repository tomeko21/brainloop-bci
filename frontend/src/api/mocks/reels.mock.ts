/**
 * ============================================================
 *  MOCK FEED DATA – to be replaced by GET /api/feed
 * ============================================================
 * Generates an infinite, deterministic stream of reels.
 * Instead of real videos we have color palettes – the
 * ReelPlayer component "fakes" playback with an animated gradient.
 */
import type { Reel, ReelMood } from "@/types/domain";
import { pick, seeded } from "./random";

const HANDLES = [
  "neon.koi", "synth.drift", "pixel_monk", "aurora.lab", "lofi.orbit",
  "kacper.codes", "glitch.garden", "deep.focus", "nightcity.fm", "zen.loops",
  "bitwave", "holo.chef",
] as const;

const CAPTIONS: Record<ReelMood, readonly string[]> = {
  calm: [
    "4 minutes of breathing in the rain 🌧️",
    "Forest at dawn – no music, just nature",
    "Slow waves. Stay here a while.",
    "Lo-fi for studying, part 12",
    "Origami crane step by step",
  ],
  neutral: [
    "How EEG works in 30 seconds 🧠",
    "Ramen recipe in 60 s",
    "Desk setup 2026 – what changed",
    "Fun fact: the brain uses 20% of your energy",
    "This is what a hackathon looks like at 3 a.m.",
  ],
  intense: [
    "FASTEST speedrun in history 😱",
    "You won't believe what happened next…",
    "TOP 10 moments that changed the internet",
    "The bass drop that blew the speakers 🔊",
    "Challenge: 100 push-ups in 2 minutes",
  ],
};

const TAGS = ["focus", "neuro", "chill", "tech", "hackathon", "lofi", "science", "food", "music", "viral"] as const;

export const MOCK_TOTAL_REELS = 120;

export function generateMockReel(index: number): Reel {
  const r = seeded(index * 7919 + 13);
  const roll = r();
  const mood: ReelMood = roll < 0.33 ? "calm" : roll < 0.66 ? "neutral" : "intense";
  const hueA = Math.floor(r() * 360);
  const hueB = (hueA + 60 + Math.floor(r() * 120)) % 360;
  const tagCount = 2 + Math.floor(r() * 2);
  const tags = Array.from({ length: tagCount }, () => pick(r, TAGS));

  return {
    id: `reel_${index.toString().padStart(4, "0")}`,
    author: {
      handle: pick(r, HANDLES),
      avatarHue: Math.floor(r() * 360),
      verified: r() > 0.7,
    },
    caption: pick(r, CAPTIONS[mood]),
    tags: [...new Set(tags)],
    durationSec: 8 + Math.floor(r() * 22),
    palette: [hueA, hueB],
    mood,
    likes: Math.floor(r() * 48_000),
    comments: Math.floor(r() * 1_200),
    likedByMe: false,
    createdAt: new Date(Date.now() - Math.floor(r() * 5 * 86_400_000)).toISOString(),
  };
}
