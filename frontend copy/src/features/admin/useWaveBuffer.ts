import { useEffect, useState } from "react";
import { ELECTRODES, type BrainSnapshot, type Electrode } from "@/types/domain";

type Waves = Record<Electrode, number[]>;
const EMPTY = Object.fromEntries(ELECTRODES.map((e) => [e, []])) as unknown as Waves;

// Each snapshot (10/s) carries only the new ~50 Hz samples in `wave`, so the trace scrolls in real time.
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
