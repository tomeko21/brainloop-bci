import { motion } from "motion/react";
import { Leaf } from "lucide-react";

export function FeedEnd() {
  return (
    <section className="grid h-full shrink-0 snap-start place-items-center bg-[radial-gradient(circle_at_center,rgb(52_211_153/0.18),transparent_60%)] p-8 text-center text-white">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }}>
        <Leaf className="mx-auto size-12 text-ok" />
        <h2 className="mt-4 text-2xl font-semibold">You've reached the end of the feed</h2>
        <p className="mt-2 text-white/70">A good moment for a 2-minute break. Your brain will thank you.</p>
      </motion.div>
    </section>
  );
}
