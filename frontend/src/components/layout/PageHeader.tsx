import { motion } from "motion/react";

export function PageHeader({ eyebrow, title, right }: { eyebrow?: string; title: React.ReactNode; right?: React.ReactNode }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 flex items-end justify-between gap-4"
    >
      <div>
        {eyebrow && <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.25em] text-neon-cyan">{eyebrow}</p>}
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      </div>
      {right}
    </motion.header>
  );
}
