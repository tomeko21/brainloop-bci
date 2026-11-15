export function MiniTrace({ values, color, min, max }: { values: number[]; color: string; min?: number; max?: number }) {
  const w = 120;
  const h = 28;
  if (values.length < 2) return <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-full" />;
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const span = hi - lo || 1;
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - lo) / span) * (h - 4)).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-7 w-full">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
