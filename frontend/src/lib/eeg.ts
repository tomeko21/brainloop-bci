import type { BrainSnapshot, ContactQuality, Electrode } from "@/types/domain";

/** Channel colors matching the BrainAccess app (easy to compare both screens). */
export const CHANNEL_COLORS: Record<Electrode, string> = {
  F4: "#b54a4a",
  F3: "#8fbf3f",
  C4: "#3fa7b0",
  C3: "#7a3fb5",
  P4: "#a8913f",
  P3: "#3fa85f",
  O2: "#3f5fb0",
  O1: "#a83f8f",
};

/** PTP thresholds (µV). EEG with good contact is usually 10-200 µV peak-to-peak. */
export const PTP_THRESHOLDS = {
  /** Below = flat line / channel not transmitting. */
  flatUv: 0.5,
  /** Above = saturation / no skin contact / large artifact. */
  maxGoodUv: 500,
} as const;

export function qualityFromPtp(ptpUv: number): ContactQuality {
  if (!Number.isFinite(ptpUv) || ptpUv < PTP_THRESHOLDS.flatUv) return "none";
  if (ptpUv > PTP_THRESHOLDS.maxGoodUv) return "poor";
  return "good";
}

/** Channel quality: from the backend, or computed from PTP if it did not arrive. */
export function channelQuality(s: BrainSnapshot | undefined, e: Electrode): ContactQuality {
  if (!s) return "none";
  return s.quality?.[e] ?? qualityFromPtp(s.ptpUv?.[e] ?? 0);
}

export function formatUv(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return `${v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} µV`;
}

export const QUALITY_META: Record<ContactQuality, { label: string; color: string }> = {
  good: { label: "good contact", color: "var(--color-ok)" },
  poor: { label: "poor contact / artifact", color: "var(--color-warn)" },
  none: { label: "no signal", color: "var(--color-danger)" },
};
