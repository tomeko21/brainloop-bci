import { motion } from "motion/react";
import { Logo } from "@/components/ui";
import { HeroOrb } from "@/features/onboarding/components/HeroOrb";
import { OnboardingForm } from "@/features/onboarding/components/OnboardingForm";
import { LastExportNotice } from "@/features/onboarding/components/LastExportNotice";

export default function OnboardingPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 py-6">
      <Logo />
      <div className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }} className="text-center lg:text-left">
          <HeroOrb />
          <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            Scroll.<br />
            <span className="text-neon">Your brain will tell you when it's enough.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-muted lg:mx-0">
            A feed that watches your fatigue through the camera and EEG – and knows when to give you a break.
          </p>
        </motion.div>
        <div className="flex flex-col items-center gap-4 lg:items-end">
          <LastExportNotice />
          <OnboardingForm />
        </div>
      </div>
    </div>
  );
}
