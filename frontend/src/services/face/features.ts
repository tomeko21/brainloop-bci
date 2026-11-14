/** Pure functions computing features from face landmarks (easy to test and to port to Python). */

export interface Pt {
  x: number;
  y: number;
  z?: number;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Eye Aspect Ratio (Soukupová & Čech). ~0.25-0.35 open, < 0.2 closed. */
export function eyeAspectRatio(lm: Pt[], idx: readonly number[]): number {
  const [p1, p2, p3, p4, p5, p6] = idx.map((i) => lm[i]);
  const h = dist(p1, p4);
  return h > 0 ? (dist(p2, p6) + dist(p3, p5)) / (2 * h) : 0;
}

/**
 * Head angles from the MediaPipe transformation matrix (4x4, column-major).
 * Returns degrees: pitch (nodding, + = down), yaw (turn), roll (tilt).
 */
export function headPoseFromMatrix(m: number[]): { pitch: number; yaw: number; roll: number } {
  const r = (v: number) => (v * 180) / Math.PI;
  const pitch = Math.atan2(m[6], m[10]);
  const yaw = Math.asin(Math.max(-1, Math.min(1, -m[2])));
  const roll = Math.atan2(m[1], m[0]);
  return { pitch: r(pitch), yaw: r(yaw), roll: r(roll) };
}

/** Iris position relative to the corners/eyelids: 0..1 (0.5 = center). */
export function irisRatio(iris: Pt, cornerA: Pt, cornerB: Pt, top: Pt, bottom: Pt) {
  const w = cornerB.x - cornerA.x;
  const h = bottom.y - top.y;
  return {
    x: w !== 0 ? (iris.x - cornerA.x) / w : 0.5,
    y: h !== 0 ? (iris.y - top.y) / h : 0.5,
  };
}

/**
 * Blink detector + PERCLOS over a time window.
 * Blink = closed -> open transition when the closure lasted 50-500 ms.
 */
export class BlinkMeter {
  private closedSince: number | null = null;
  private blinks: number[] = [];
  private samples: { t: number; closed: boolean }[] = [];
  total = 0;
  private readonly windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  update(t: number, closed: boolean) {
    if (closed && this.closedSince === null) this.closedSince = t;
    if (!closed && this.closedSince !== null) {
      const d = t - this.closedSince;
      if (d >= 50 && d <= 500) {
        this.blinks.push(t);
        this.total++;
      }
      this.closedSince = null;
    }
    this.samples.push({ t, closed });
    const from = t - this.windowMs;
    while (this.samples.length && this.samples[0].t < from) this.samples.shift();
    while (this.blinks.length && this.blinks[0] < from) this.blinks.shift();
  }

  /** Blinks per minute (scaled while the window is not yet full). */
  ratePerMin(t: number): number {
    const span = Math.min(this.windowMs, Math.max(1_000, t - (this.samples[0]?.t ?? t)));
    return (this.blinks.length / span) * 60_000;
  }

  /** Fraction of samples with closed eyes in the window (PERCLOS). */
  perclos(): number {
    if (!this.samples.length) return 0;
    return this.samples.filter((s) => s.closed).length / this.samples.length;
  }

  reset() {
    this.closedSince = null;
    this.blinks = [];
    this.samples = [];
    this.total = 0;
  }
}
