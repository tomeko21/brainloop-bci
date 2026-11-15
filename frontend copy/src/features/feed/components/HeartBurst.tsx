import { AnimatePresence, motion } from "motion/react";
import { Heart } from "lucide-react";

export function HeartBurst({ burstKey }: { burstKey: number }) {
  return (
    <AnimatePresence>
      {burstKey > 0 && (
        <motion.div
          key={burstKey}
          className="pointer-events-none absolute inset-0 z-20 grid place-items-center"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ delay: 0.55, duration: 0.35 }}
        >
          <motion.div
            initial={{ scale: 0.2, rotate: -20 }}
            animate={{ scale: [0.2, 1.25, 1], rotate: [-20, 8, 0] }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <Heart className="size-28 fill-neon-pink text-neon-pink drop-shadow-[0_0_30px_var(--color-neon-pink)]" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
