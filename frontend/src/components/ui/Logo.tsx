import { Brain } from "lucide-react";
import { cn } from "@/lib/cn";

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative grid size-9 place-items-center rounded-xl bg-[linear-gradient(135deg,var(--color-neon-violet),var(--color-neon-cyan))] shadow-[0_0_24px_-4px_var(--color-neon-violet)]">
        <Brain className="size-5 text-white" strokeWidth={2.2} />
      </div>
      {!compact && (
        <span className="text-lg font-semibold tracking-tight">
          Brain<span className="text-neon">Loop</span>
        </span>
      )}
    </div>
  );
}
