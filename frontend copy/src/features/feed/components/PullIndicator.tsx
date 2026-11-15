import { motion } from "motion/react";
import { RefreshCw } from "lucide-react";

export function PullIndicator({ pull, progress, refreshing }: { pull: number; progress: number; refreshing: boolean }) {
  if (pull <= 0 && !refreshing) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center" style={{ transform: `translateY(${pull - 40}px)` }}>
      <motion.div
        className="glass grid size-11 place-items-center rounded-full shadow-[0_0_30px_-4px_var(--color-neon-violet)]"
        style={{ opacity: Math.max(0.3, progress) }}
      >
        <motion.span
          animate={refreshing ? { rotate: 360 } : { rotate: progress * 270 }}
          transition={refreshing ? { repeat: Infinity, duration: 0.8, ease: "linear" } : { duration: 0 }}
        >
          <RefreshCw className="size-5 text-neon-violet" />
        </motion.span>
      </motion.div>
    </div>
  );
}
