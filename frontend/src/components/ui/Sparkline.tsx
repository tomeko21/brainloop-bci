import { useId } from "react";

interface SparklineProps {
  values: number[];
  height?: number;
  className?: string;
}

/** Mini 0..1 line chart with a gradient fill. */
export function Sparkline({ values, height = 64, className }: SparklineProps) {
  const id = useId();
  if (values.length < 2) return null;
  const w = 240;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, height - 4 - v * (height - 8)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${height} L0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className={className} preserveAspectRatio="none" role="img" aria-label="Focus trend">
      <defs>
        <linearGradient id={`${id}-stroke`} x1="0" x2="1">
          <stop offset="0%" stopColor="var(--color-neon-cyan)" />
          <stop offset="100%" stopColor="var(--color-neon-pink)" />
        </linearGradient>
        <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--color-neon-violet)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-neon-violet)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id}-fill)`} />
      <path d={line} fill="none" stroke={`url(#${id}-stroke)`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ strokeDasharray: 600, strokeDashoffset: 600, animation: "draw 1.4s ease forwards" }} />
      <style>{`@keyframes draw { to { stroke-dashoffset: 0; } }`}</style>
    </svg>
  );
}
