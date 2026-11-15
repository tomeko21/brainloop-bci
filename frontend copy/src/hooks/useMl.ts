import { useMutation } from "@tanstack/react-query";
import { predictWindow } from "@/api/ml.api";
import type { PredictWindowInput } from "@/types/api/input/useMl";
import type { PredictWindowOutput } from "@/types/api/output/useMl";

export function usePredictWindow() {
  return useMutation<PredictWindowOutput, Error, PredictWindowInput>({ mutationFn: predictWindow });
}
