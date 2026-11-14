import { useEffect, useState } from "react";
import { ELECTRODES, type BrainSnapshot, type Electrode } from "@/types/domain";

type Waves = Record<Electrode, number[]>;
const EMPTY = Object.fromEntries(ELECTRODES.map((e) => [e, []])) as unknown as Waves;

/**
 * Rolling buffer of the raw (band-passed) EEG per electrode for the admin traces.
 * Every snapshot (10/s) carries only the samples that arrived since the previous one (`wave`, ~50 Hz),
 * so the trace scrolls in real time – no 1.5 s analysis window in between.
 */
export function useWaveBuffer(snapshot: BrainSnapshot | undefined, seconds = 4): Waves {
  const [waves, setWaves] = useState<Waves>(EMPTY);

  useEffect(() => {
    const wave = snapshot?.wave;
    if (!wave) return;
    const max = Math.round(seconds * (snapshot.waveHz ?? 50));
    setWaves((prev) => {
      const next = { ...prev };
      for (const e of ELECTRODES) {
        const add = wave[e];
        if (add?.length) next[e] = [...prev[e], ...add].slice(-max);
      }
      return next;
    });
  }, [snapshot, seconds]);

  return waves;
}
