import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/cn";

type CardProps = HTMLMotionProps<"div"> & { glow?: boolean };

export function Card({ className, glow, children, ...props }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "glass relative overflow-hidden rounded-[1.25rem] p-5",
        glow && "shadow-[0_0_0_1px_rgb(167_139_250/0.15),0_20px_60px_-20px_rgb(167_139_250/0.35)]",
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function CardTitle({ icon, children, right }: { icon?: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        {icon}
        {children}
      </h3>
      {right}
    </div>
  );
}
