import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { EEG_TRANSPORT, subscribeEegStream } from "@/api/eeg.api";
import type { StreamStatus } from "@/lib/realtime/types";
import type { EegStreamInput } from "@/types/api/input/useEeg";
import type { EegStreamMessage, EegStreamOutput } from "@/types/api/output/useEeg";
import { queryKeys } from "./queryKeys";

/**
 * Listens to the EEG stream (SSE / WebSocket / mock).
 * Every message goes into the React Query cache (setQueryData), so any component
 * can read the latest snapshot via the same key – no polling.
 */
export function useEegStream({ sessionId, enabled = true }: EegStreamInput = {}): EegStreamOutput {
  const qc = useQueryClient();
  const key = queryKeys.eegLive(sessionId);
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [rateHz, setRateHz] = useState(0);
  const stamps = useRef<number[]>([]);

  const { data } = useQuery<EegStreamMessage>({
    queryKey: key,
    queryFn: () => new Promise<never>(() => {}), // data arrives only from the stream
    enabled: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!enabled) return;
    const handle = subscribeEegStream(
      { sessionId },
      {
        onMessage: (msg) => {
          qc.setQueryData(key, msg);
          stamps.current.push(performance.now());
        },
        onStatus: setStatus,
      },
    );
    const rateTimer = window.setInterval(() => {
      const from = performance.now() - 2_000;
      stamps.current = stamps.current.filter((t) => t >= from);
      setRateHz(stamps.current.length / 2);
    }, 1_000);
    return () => {
      handle.close();
      window.clearInterval(rateTimer);
    };
  }, [sessionId, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, status, transport: EEG_TRANSPORT, rateHz };
}
