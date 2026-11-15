import { motion } from "motion/react";
import { Brain } from "lucide-react";

export function HeroOrb() {
  return (
    <div className="relative mx-auto grid size-56 place-items-center sm:size-72">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute inset-0 rounded-full border border-neon-violet/30"
          animate={{ scale: [0.6, 1.25], opacity: [0.8, 0] }}
          transition={{ duration: 3.6, repeat: Infinity, delay: i * 1.2, ease: "easeOut" }}
        />
      ))}
      <motion.div
        className="absolute inset-[18%] rounded-full bg-[conic-gradient(from_0deg,var(--color-neon-violet),var(--color-neon-cyan),var(--color-neon-pink),var(--color-neon-violet))] blur-2xl"
        animate={{ rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="relative grid size-28 place-items-center rounded-full border border-white/20 bg-black/40 backdrop-blur-xl sm:size-32"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <Brain className="size-12 text-white drop-shadow-[0_0_14px_rgb(167_139_250)] sm:size-14" strokeWidth={1.6} />
      </motion.div>
    </div>
  );
}
