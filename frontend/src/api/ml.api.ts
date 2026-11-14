/** ML API: BRI prediction from camera + scroll features (backend: app/ml/predictor.py). */
import type { PredictWindowInput } from "@/types/api/input/useMl";
import type { PredictWindowOutput } from "@/types/api/output/useMl";
import { http } from "./client";

export function predictWindow(input: PredictWindowInput): Promise<PredictWindowOutput> {
  return http<PredictWindowOutput>("/api/ml/predict-window", { method: "POST", body: input });
}
