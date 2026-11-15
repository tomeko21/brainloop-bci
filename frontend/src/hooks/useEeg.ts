import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  EEG_TRANSPORT, connectHeadset, eegBaseline, disconnectHeadset, fetchEegStatus, scanHeadsets, selectEegStream, subscribeEegStream,
} from "@/api/eeg.api";
import type { StreamStatus } from "@/lib/realtime/types";
import type { EegBaselineInput, EegConnectInput, EegSelectInput, EegStreamInput } from "@/types/api/input/useEeg";
import type { EegBaselineOutput, EegScanOutput, EegStatusOutput, EegStreamMessage, EegStreamOutput } from "@/types/api/output/useEeg";
import { queryKeys } from "./queryKeys";

// Every stream message goes into the query cache, so any component can read the latest snapshot by key.
export function useEegStream({ sessionId, enabled = true }: EegStreamInput = {}): EegStreamOutput {
  const qc = useQueryClient();
  const key = queryKeys.eegLive(sessionId);
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [rateHz, setRateHz] = useState(0);
  const stamps = useRef<number[]>([]);

  const { data } = useQuery<EegStreamMessage>({
    queryKey: key,
    queryFn: () => new Promise<never>(() => {}),  // data only arrives through the stream
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

export function useEegStatus() {
  return useQuery<EegStatusOutput>({
    queryKey: queryKeys.eegStatus,
    queryFn: fetchEegStatus,
    refetchInterval: 3_000,
    refetchIntervalInBackground: true,
    retry: false,
  });
}

export function useSelectEegStream() {
  const qc = useQueryClient();
  return useMutation<EegStatusOutput, Error, EegSelectInput>({
    mutationFn: selectEegStream,
    onSuccess: (status) => qc.setQueryData(queryKeys.eegStatus, status),
  });
}

export function useScanHeadsets() {
  return useMutation<EegScanOutput, Error, void>({ mutationFn: scanHeadsets });
}

export function useConnectHeadset() {
  const qc = useQueryClient();
  return useMutation<EegStatusOutput, Error, EegConnectInput>({
    mutationFn: connectHeadset,
    onSuccess: (status) => qc.setQueryData(queryKeys.eegStatus, status),
  });
}

export function useDisconnectHeadset() {
  const qc = useQueryClient();
  return useMutation<EegStatusOutput, Error, void>({
    mutationFn: disconnectHeadset,
    onSuccess: (status) => qc.setQueryData(queryKeys.eegStatus, status),
  });
}

export function useEegBaseline() {
  return useMutation<EegBaselineOutput, Error, EegBaselineInput>({ mutationFn: eegBaseline });
}
