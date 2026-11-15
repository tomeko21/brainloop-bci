import { motion } from "motion/react";
import { ArrowRight, Radar, User } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Input } from "@/components/ui";
import { useSessionLifecycle } from "@/features/session/useSessionLifecycle";
import { selectIsActive, useSessionStore } from "@/store/sessionStore";
import { ROUTES } from "@/app/routes";
import { CameraOptIn } from "./CameraOptIn";
import { EegConnectPanel } from "@/features/recording/components/EegConnectPanel";

export function OnboardingForm() {
  const [name, setName] = useState("");
  const [camera, setCamera] = useState(false);
  const { begin, starting, error } = useSessionLifecycle();
  const activeSession = useSessionStore((s) => (selectIsActive(s) ? s.session : null));
  const navigate = useNavigate();
  const trimmed = name.trim();

  return (
    <motion.form
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed) begin({ subjectName: trimmed, cameraEnabled: camera });
      }}
      className="glass w-full max-w-md space-y-4 rounded-[1.5rem] p-6 shadow-[0_30px_80px_-30px_rgb(167_139_250/0.45)]"
    >
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-neon-cyan">New session</p>
        <h2 className="mt-1 text-xl font-semibold">Who are you?</h2>
      </div>

      <Input
        autoFocus
        icon={<User className="size-5" />}
        placeholder="Username, e.g. Kacper"
        value={name}
        maxLength={32}
        onChange={(e) => setName(e.target.value)}
      />

      <CameraOptIn enabled={camera} onChange={setCamera} />

      <EegConnectPanel />

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={!trimmed} loading={starting}>
        {camera ? "Start and record" : "Enter the feed"}
        <ArrowRight className="size-5" />
      </Button>

      {activeSession && (
        <Button type="button" variant="secondary" className="w-full" onClick={() => navigate(ROUTES.feed)}>
          Back to session: {activeSession.subjectName}
        </Button>
      )}

      <Link to={ROUTES.admin} className="flex items-center justify-center gap-1.5 pt-1 text-xs text-muted transition-colors hover:text-neon-violet">
        <Radar className="size-3.5" /> Admin panel
      </Link>
    </motion.form>
  );
}
