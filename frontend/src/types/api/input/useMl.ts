import type { MlFeatureWindow } from "@/types/domain";

/** POST /api/ml/predict-window – feature vector from the last ~10 s (camera + scroll). */
export type PredictWindowInput = MlFeatureWindow;
