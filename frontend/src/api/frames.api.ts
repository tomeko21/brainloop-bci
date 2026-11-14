/** Camera frames: batches of JPEG frames sent during the session for server-side analysis. */
import type { UploadFramesInput } from "@/types/api/input/useFrames";
import type { UploadFramesOutput } from "@/types/api/output/useFrames";
import { http } from "./client";

export function uploadFrames(input: UploadFramesInput): Promise<UploadFramesOutput> {
  const form = new FormData();
  input.frames.forEach((f) => form.append("frames", f.blob, `${f.tsMs}.jpg`));
  form.append("timestamps", input.frames.map((f) => f.tsMs).join(","));
  return http<UploadFramesOutput>(`/api/sessions/${input.sessionId}/frames`, { method: "POST", body: form });
}
