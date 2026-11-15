export interface PlaybackSnapshot {
  positionMs: number;  // within the current loop
  durationMs: number;
  loops: number;
  paused: boolean;
}
