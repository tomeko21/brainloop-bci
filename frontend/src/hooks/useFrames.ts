import { useMutation } from "@tanstack/react-query";
import { uploadFrames } from "@/api/frames.api";
import type { UploadFramesInput } from "@/types/api/input/useFrames";
import type { UploadFramesOutput } from "@/types/api/output/useFrames";

export function useUploadFrames() {
  return useMutation<UploadFramesOutput, Error, UploadFramesInput>({ mutationFn: uploadFrames });
}
