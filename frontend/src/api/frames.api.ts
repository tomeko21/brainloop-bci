// JPEG frame batches for server-side analysis (backend app/ml/video_features.py).
import type { UploadFramesInput } from "@/types/api/input/useFrames";
import type { UploadFramesOutput } from "@/types/api/output/useFrames";
import { http } from "./client";

export function uploadFrames(input: UploadFramesInput): Promise<UploadFramesOutput> {
  const form = new FormData();
  input.frames.forEach((f) => form.append("frames", f.blob, `${f.tsMs}.jpg`));
  form.append("timestamps", input.frames.map((f) => f.tsMs).join(","));
  return http<UploadFramesOutput>(`/api/sessions/${input.sessionId}/frames`, { method: "POST", body: form });
}
