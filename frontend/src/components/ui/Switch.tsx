import { motion } from "motion/react";
import { cn } from "@/lib/cn";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 cursor-pointer rounded-full border border-border transition-colors duration-300 disabled:opacity-50",
        checked ? "bg-[linear-gradient(90deg,var(--color-neon-violet),var(--color-neon-cyan))]" : "bg-surface-strong",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 600, damping: 32 }}
        className={cn(
          "absolute top-0.5 size-[22px] rounded-full bg-white shadow-md",
          checked ? "right-0.5" : "left-0.5",
        )}
      />
    </button>
  );
}
