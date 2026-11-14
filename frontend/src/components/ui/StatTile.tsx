import { motion } from "motion/react";
import { cn } from "@/lib/cn";

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  accent?: "violet" | "cyan" | "pink" | "lime";
  index?: number;
}

const ACCENT = {
  violet: "from-neon-violet/25",
  cyan: "from-neon-cyan/25",
  pink: "from-neon-pink/25",
  lime: "from-neon-lime/25",
};

export function StatTile({ label, value, hint, icon, accent = "violet", index = 0 }: StatTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className="glass relative overflow-hidden rounded-ui p-4"
    >
      <div className={cn("pointer-events-none absolute -right-6 -top-6 size-20 rounded-full bg-gradient-to-br to-transparent blur-xl", ACCENT[accent])} />
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-2 font-mono text-2xl font-medium tabular-nums text-fg">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </motion.div>
  );
}
