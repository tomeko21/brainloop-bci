import { cn } from "@/lib/cn";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode };

export function Input({ className, icon, ...props }: InputProps) {
  return (
    <div className="group relative">
      {icon && (
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted transition-colors group-focus-within:text-neon-violet">
          {icon}
        </span>
      )}
      <input
        className={cn(
          "glass h-14 w-full rounded-ui px-4 text-base text-fg placeholder:text-muted/70 outline-none transition-all",
          "focus:border-neon-violet/60 focus:shadow-[0_0_0_4px_rgb(167_139_250/0.15)]",
          icon && "pl-12",
          className,
        )}
        {...props}
      />
    </div>
  );
}
