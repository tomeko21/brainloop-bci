import { motion } from "motion/react";
import { Brain } from "lucide-react";
import { NoEegData } from "./NoEegData";
import { Card, CardTitle } from "@/components/ui";
import type { EegStreamOutput } from "@/types/api/output/useEeg";
import { StreamBadge } from "./StreamBadge";
import { CHANNEL_COLORS, QUALITY_META, channelQuality } from "@/lib/eeg";
import { ELECTRODES, type Electrode } from "@/types/domain";
import type { BrainSnapshot } from "@/types/domain";

// BrainAccess electrode positions, 10-20 system seen from above, nose up.
const POS: Record<Electrode, { x: number; y: number }> = {
  F3: { x: 104, y: 106 }, F4: { x: 196, y: 106 },
  C3: { x: 90, y: 172 }, C4: { x: 210, y: 172 },
  P3: { x: 104, y: 238 }, P4: { x: 196, y: 238 },
  O1: { x: 128, y: 294 }, O2: { x: 172, y: 294 },
};

const LEFT = "M148 34 C104 30 58 62 48 122 C38 182 52 258 94 298 C114 316 136 324 148 318 Z";
const RIGHT = "M152 34 C196 30 242 62 252 122 C262 182 248 258 206 298 C186 316 164 324 152 318 Z";
const GYRI = [
  "M70 110 C90 100 110 118 132 104", "M60 160 C82 148 100 172 136 156", "M66 214 C92 204 112 226 138 210",
  "M90 270 C106 258 124 278 140 266", "M230 110 C210 100 190 118 168 104", "M240 160 C218 148 200 172 164 156",
  "M234 214 C208 204 188 226 162 210", "M210 270 C194 258 176 278 160 266", "M100 70 C112 84 128 72 140 84",
  "M200 70 C188 84 172 72 160 84",
];

const colorFor = (v: number) => `hsl(${190 + v * 135} 95% ${55 + v * 10}%)`;

export function BrainMap({ stream, live }: { stream: EegStreamOutput; live: boolean }) {
  const data: BrainSnapshot | undefined = stream.data;
  return (
    <Card glow className="flex flex-col">
      <CardTitle icon={<Brain className="size-3.5" />} right={<StreamBadge stream={stream} />}>
        Cortical activity
      </CardTitle>
      {!live ? (
        <NoEegData />
      ) : (
        <>
      <div className="relative mx-auto w-full max-w-sm">
        <svg viewBox="0 0 300 350" className="w-full">
          <defs>
            <clipPath id="brain-clip"><path d={LEFT} /><path d={RIGHT} /></clipPath>
            <filter id="heat-blur"><feGaussianBlur stdDeviation="16" /></filter>
            <linearGradient id="brain-stroke" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-neon-cyan)" />
              <stop offset="100%" stopColor="var(--color-neon-violet)" />
            </linearGradient>
            <linearGradient id="scan-grad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-neon-cyan)" stopOpacity="0" />
              <stop offset="50%" stopColor="var(--color-neon-cyan)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--color-neon-cyan)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path d="M138 30 L150 12 L162 30" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" />

          <g clipPath="url(#brain-clip)">
            <rect width="300" height="350" fill="var(--bg-elev)" />
            <g filter="url(#heat-blur)">
              {ELECTRODES.map((e) => {
                const ok = channelQuality(data, e) === "good"; // no contact means the value is noise, keep it dark
                const v = ok ? (data?.channels[e] ?? 0.1) : 0;
                return (
                  <circle key={e} cx={POS[e].x} cy={POS[e].y} r={48} fill={colorFor(v)}
                    style={{ opacity: ok ? 0.15 + v * 0.8 : 0, transition: "opacity 120ms linear, fill 120ms linear" }} />
                );
              })}
            </g>
            {GYRI.map((d) => <path key={d} d={d} fill="none" stroke="var(--fg)" strokeOpacity="0.14" strokeWidth="2" strokeLinecap="round" />)}
            <motion.rect x="0" width="300" height="60" fill="url(#scan-grad)"
              animate={{ y: [-60, 350] }} transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }} />
          </g>

          <path d={LEFT} fill="none" stroke="url(#brain-stroke)" strokeWidth="2" />
          <path d={RIGHT} fill="none" stroke="url(#brain-stroke)" strokeWidth="2" />

          {ELECTRODES.map((e) => {
            const q = channelQuality(data, e);
            const v = q === "good" ? (data?.channels[e] ?? 0.1) : 0;
            const { x, y } = POS[e];
            return (
              <g key={e}>
                <title>{`${e}: ${QUALITY_META[q].label}`}</title>
                {q === "good" && v > 0.7 && (
                  <circle cx={x} cy={y} r="6" fill="none" stroke={colorFor(v)} strokeWidth="1.5">
                    <animate attributeName="r" from="6" to="20" dur="1.2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.9" to="0" dur="1.2s" repeatCount="indefinite" />
                  </circle>
                )}
                {q === "good" ? (
                  <circle cx={x} cy={y} r="5" fill="white" stroke={CHANNEL_COLORS[e]} strokeWidth="2.5" />
                ) : (
                  <g>
                    <circle cx={x} cy={y} r="6" fill="var(--bg-elev)" stroke={QUALITY_META[q].color} strokeWidth="1.5" strokeDasharray="2 2" />
                    <path d={`M${x - 3} ${y - 3} L${x + 3} ${y + 3} M${x + 3} ${y - 3} L${x - 3} ${y + 3}`} stroke={QUALITY_META[q].color} strokeWidth="1.5" />
                  </g>
                )}
                <text x={x} y={y - 11} textAnchor="middle" className="fill-fg font-mono text-[10px]">{e}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap justify-center gap-3 text-[10px] text-muted">
        {(["good", "poor", "none"] as const).map((q) => (
          <span key={q} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: QUALITY_META[q].color }} />
            {QUALITY_META[q].label}
          </span>
        ))}
      </div>
        </>
      )}
    </Card>
  );
}
