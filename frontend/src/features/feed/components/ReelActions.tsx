import { AnimatePresence, motion } from "motion/react";
import { Bookmark, Heart, MessageCircle, Send } from "lucide-react";
import { useState } from "react";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Reel } from "@/types/domain";

interface Props {
  reel: Reel;
  onToggleLike: () => void;
}

function ActionButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.82 }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="flex cursor-pointer flex-col items-center gap-1 text-white"
    >
      <span className="grid size-12 place-items-center rounded-full bg-white/10 backdrop-blur-md transition-colors hover:bg-white/20">
        {children}
      </span>
      <span className="font-mono text-[11px] tabular-nums drop-shadow">{label}</span>
    </motion.button>
  );
}

export function ReelActions({ reel, onToggleLike }: Props) {
  const [saved, setSaved] = useState(false);

  return (
    <div className="flex flex-col items-center gap-4">
      <ActionButton label={formatCount(reel.likes)} onClick={onToggleLike}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={String(reel.likedByMe)}
            initial={{ scale: 0.3, rotate: -25 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0.3, opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 14 }}
          >
            <Heart className={cn("size-6", reel.likedByMe && "fill-neon-pink text-neon-pink drop-shadow-[0_0_10px_var(--color-neon-pink)]")} />
          </motion.span>
        </AnimatePresence>
      </ActionButton>
      <ActionButton label={formatCount(reel.comments)}>
        <MessageCircle className="size-6" />
      </ActionButton>
      <ActionButton label="Share">
        <Send className="size-6" />
      </ActionButton>
      <ActionButton label={saved ? "Saved" : "Save"} onClick={() => setSaved((s) => !s)}>
        <Bookmark className={cn("size-6", saved && "fill-neon-cyan text-neon-cyan")} />
      </ActionButton>
    </div>
  );
}
