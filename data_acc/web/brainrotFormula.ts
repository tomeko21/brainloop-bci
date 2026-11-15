// Brain Rot formula for the web, same math as data_acc/brainrot.py.
// Model is artifacts/3_weights/brainrot_model.json (e.g. copied to frontend/public/).
// Feed baseline windows from the fixation cross (skip the first 15 s like training), call finishBaseline(),
// then compute() every 0.5 s with features named as in process.py features.csv (2 s windows).

export interface BrainRotModel {
  weights: Record<string, number>;
  calibration: { s_mid: number; s_scale: number };
  sensitive?: { negative_factor: number; calibration: { s_mid: number; s_scale: number } };
  log_features: string[];
  z_clip: number;
  default_baseline: Record<string, { mean: number; std: number }>;
}

export interface BriResult {
  bri: number | null; // calm baseline about 25, typical Instagram about 75
  briSensitive: number | null; // inflated, baseline about 35, Instagram about 90
  z: Record<string, number>; // in baseline standard deviations
  topFactors: [string, number][]; // biggest w * z contributions
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const toBri = (s: number, c: { s_mid: number; s_scale: number }) =>
  clamp(100 / (1 + Math.exp(-(s - c.s_mid) / c.s_scale)), 0, 100);

export class BrainRotFormula {
  private baseline: Record<string, { mean: number; std: number }>;
  private collected: Record<string, number[]> = {};
  private logSet: Set<string>;

  constructor(private model: BrainRotModel) {
    this.baseline = { ...model.default_baseline }; // fallback until finishBaseline()
    this.logSet = new Set(model.log_features);
  }

  private t(name: string, v: number): number {
    return this.logSet.has(name) ? Math.log(Math.max(v, 1e-6)) : v;
  }

  addBaselineWindow(features: Record<string, number | null | undefined>): void {
    for (const f of Object.keys(this.model.weights)) {
      const v = features[f];
      if (v != null && Number.isFinite(v)) (this.collected[f] ??= []).push(this.t(f, v));
    }
  }

  // returns how many features got a personal baseline, each needs at least 5 windows
  finishBaseline(): number {
    let n = 0;
    for (const [f, xs] of Object.entries(this.collected)) {
      if (xs.length < 5) continue;
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
      const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1));
      const fallback = this.model.default_baseline[f]?.std ?? 0;
      this.baseline[f] = { mean, std: Math.max(sd, 0.5 * fallback, 1e-9) };
      n++;
    }
    this.collected = {};
    return n;
  }

  compute(features: Record<string, number | null | undefined>): BriResult {
    const w = this.model.weights;
    const z: Record<string, number> = {};
    const contrib: Record<string, number> = {};
    let have = 0;
    let total = 0;
    for (const [f, wf] of Object.entries(w)) {
      total += Math.abs(wf);
      const v = features[f];
      const b = this.baseline[f];
      if (v == null || !Number.isFinite(v) || !b) continue;
      z[f] = clamp((this.t(f, v) - b.mean) / b.std, -this.model.z_clip, this.model.z_clip);
      contrib[f] = wf * z[f];
      have += Math.abs(wf);
    }
    if (total === 0 || have / total < 0.5) return { bri: null, briSensitive: null, z, topFactors: [] };
    const cs = Object.values(contrib);
    const s = cs.reduce((a, b) => a + b, 0);
    let briSensitive: number | null = null;
    if (this.model.sensitive) {
      const k = this.model.sensitive.negative_factor;
      const s2 = cs.reduce((a, c) => a + (c > 0 ? c : k * c), 0);
      briSensitive = toBri(s2, this.model.sensitive.calibration);
    }
    const topFactors = Object.entries(contrib)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 5);
    return { bri: toBri(s, this.model.calibration), briSensitive, z, topFactors };
  }
}
