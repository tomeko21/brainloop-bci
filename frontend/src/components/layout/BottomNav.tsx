/**
 * Floating bottom navigation (Feed / Settings / Admin) with an animated active pill.
 */
import { motion } from "motion/react";
import { Clapperboard, Radar, SlidersHorizontal } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/cn";
import { ROUTES } from "@/app/routes";

const ITEMS = [
  { to: ROUTES.feed, label: "Feed", icon: Clapperboard },
  { to: ROUTES.settings, label: "Settings", icon: SlidersHorizontal },
  { to: ROUTES.admin, label: "Admin", icon: Radar },
];

export function BottomNav() {
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(env(safe-area-inset-bottom),12px)]">
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.1 }}
        className="glass pointer-events-auto flex gap-1 rounded-full p-1.5 shadow-[0_10px_40px_-10px_rgb(0_0_0/0.6)]"
      >
        {ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className="relative">
            {({ isActive }) => (
              <span
                className={cn(
                  "relative flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "text-white" : "text-muted hover:text-fg",
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-[linear-gradient(110deg,var(--color-neon-violet),var(--color-neon-pink))]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon className="relative size-4" />
                <span className={cn("relative", !isActive && "hidden sm:inline")}>{label}</span>
              </span>
            )}
          </NavLink>
        ))}
      </motion.div>
    </nav>
  );
}
