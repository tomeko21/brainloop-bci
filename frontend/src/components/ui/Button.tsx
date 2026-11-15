import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 rounded-ui font-medium select-none cursor-pointer " +
    "transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-violet/60",
  {
    variants: {
      variant: {
        primary:
          "text-white bg-[linear-gradient(110deg,var(--color-neon-violet),var(--color-neon-pink)_55%,var(--color-neon-cyan))] " +
          "bg-[length:200%_100%] hover:bg-[position:100%_0] shadow-[0_8px_30px_-8px_rgb(167_139_250/0.6)]",
        secondary: "glass text-fg hover:bg-surface-strong",
        danger: "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25",
        ghost: "text-muted hover:text-fg hover:bg-surface",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-11 px-5 text-sm",
        lg: "h-14 px-7 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { loading?: boolean };

export function Button({ className, variant, size, loading, children, disabled, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
