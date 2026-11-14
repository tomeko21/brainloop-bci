/** State of the "fake" playback of the active reel. */
export interface PlaybackSnapshot {
  /** Position in the current pass of the reel (0..duration). */
  positionMs: number;
  durationMs: number;
  /** How many times the reel reached the end and restarted. */
  loops: number;
  paused: boolean;
}
