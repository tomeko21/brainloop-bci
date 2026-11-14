/**
 * AI model API ("no headset" mode: camera + scroll -> BRI).
 * ⚠️ MOCK: when USE_MOCKS === true the result comes from the heuristic in ./mocks/ml.mock.ts,
 *          not a trained model. Real one: LightGBM in backend/app/ml.
 */
import type { PredictWindowInput } from "@/types/api/input/useMl";
import type { PredictWindowOutput } from "@/types/api/output/useMl";
import { USE_MOCKS, http, mockDelay } from "./client";
import { mockPredict } from "./mocks/ml.mock";

export async function predictWindow(input: PredictWindowInput): Promise<PredictWindowOutput> {
  if (!USE_MOCKS) return http<PredictWindowOutput>("/api/ml/predict-window", { method: "POST", body: input });
  await mockDelay(40, 120); // --- MOCK ---
  return mockPredict(input);
}
