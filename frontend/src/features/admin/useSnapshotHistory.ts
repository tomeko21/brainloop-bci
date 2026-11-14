import { useEffect, useState } from "react";
import type { BrainSnapshot } from "@/types/domain";

/** Last N EEG snapshots (for channel and accelerometer mini-charts). */
export function useSnapshotHistory(snapshot: BrainSnapshot | undefined, size = 48): BrainSnapshot[] {
  const [history, setHistory] = useState<BrainSnapshot[]>([]);
  useEffect(() => {
    if (snapshot) setHistory((h) => [...h.slice(-(size - 1)), snapshot]);
  }, [snapshot, size]);
  return history;
}
