/**
 * Pill-style segmented switch (e.g. Black / White background) with an animated selection.
 */
import { motion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/cn";

interface Option<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface Props<T extends string> {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ value, options, onChange }: Props<T>) {
  const id = useId();
  return (
    <div className="glass flex rounded-ui p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "relative flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[0.7rem] px-3 py-2.5 text-sm font-medium transition-colors",
            value === o.value ? "text-fg" : "text-muted hover:text-fg",
          )}
        >
          {value === o.value && (
            <motion.span
              layoutId={`seg-${id}`}
              className="absolute inset-0 rounded-[0.7rem] bg-surface-strong shadow-[inset_0_0_0_1px_var(--border)]"
              transition={{ type: "spring", stiffness: 500, damping: 36 }}
            />
          )}
          <span className="relative flex items-center gap-2">
            {o.icon}
            {o.label}
          </span>
        </button>
      ))}
    </div>
  );
}
