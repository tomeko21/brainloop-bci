import { useMutation, useQuery } from "@tanstack/react-query";
import { endSession, fetchStorageStatus, startSession, uploadDataset, uploadRecording } from "@/api/session.api";
import type { EndSessionInput, StartSessionInput, UploadDatasetInput, UploadRecordingInput } from "@/types/api/input/useSession";
import { queryKeys } from "./queryKeys";
import type { StorageStatusOutput } from "@/types/api/output/useSession";
import type { EndSessionOutput, StartSessionOutput, UploadDatasetOutput, UploadRecordingOutput } from "@/types/api/output/useSession";

export function useStartSession() {
  return useMutation<StartSessionOutput, Error, StartSessionInput>({ mutationFn: startSession });
}

export function useEndSession() {
  return useMutation<EndSessionOutput, Error, EndSessionInput>({ mutationFn: endSession });
}

export function useUploadRecording() {
  return useMutation<UploadRecordingOutput, Error, UploadRecordingInput>({ mutationFn: uploadRecording });
}

export function useUploadDataset() {
  return useMutation<UploadDatasetOutput, Error, UploadDatasetInput>({ mutationFn: uploadDataset });
}

/** Where session data goes: the data/ folder (locally), the backend, or ZIP only. */
export function useStorageStatus() {
  return useQuery<StorageStatusOutput>({
    queryKey: queryKeys.storageStatus,
    queryFn: fetchStorageStatus,
    staleTime: 60_000,
  });
}
