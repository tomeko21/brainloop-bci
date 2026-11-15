import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider",
  {
    variants: {
      tone: {
        neutral: "bg-surface-strong text-muted",
        violet: "bg-neon-violet/15 text-neon-violet",
        cyan: "bg-neon-cyan/15 text-neon-cyan",
        ok: "bg-ok/15 text-ok",
        warn: "bg-warn/15 text-warn",
        danger: "bg-danger/15 text-danger",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants> & { dot?: boolean };

export function Badge({ className, tone, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && (
        <span className="relative flex size-1.5">
          <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-70" />
          <span className="relative size-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}
