import { motion } from "motion/react";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-muted">
      <div className="relative size-12">
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-neon-violet border-r-neon-cyan"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
        />
        <span className="absolute inset-2 animate-pulse rounded-full bg-neon-violet/20" />
      </div>
      <span className="font-mono text-xs uppercase tracking-[0.2em]">{label}</span>
    </div>
  );
}
