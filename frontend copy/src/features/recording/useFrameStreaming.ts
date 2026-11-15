import { useEffect } from "react";
import { TRACKING } from "@/config/tracking";
import { useUploadFrames } from "@/hooks/useFrames";
import { useRecordingStore } from "@/store/recordingStore";
import { selectIsActive, useSessionStore } from "@/store/sessionStore";

// Small JPEG frames (2 fps, 320 px) sent to the backend in 2 s batches for face/motion analysis.
// The full .webm is still uploaded when the session ends.
export function useFrameStreaming() {
  const sessionId = useSessionStore((s) => (selectIsActive(s) ? s.session!.id : null));
  const stream = useRecordingStore((s) => (s.status === "recording" ? s.stream : null));
  const { mutateAsync } = useUploadFrames();

  useEffect(() => {
    if (!sessionId || !stream) return;

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    let buffer: { blob: Blob; tsMs: number }[] = [];
    let sending = false;

    const capture = window.setInterval(() => {
      if (!ctx || document.visibilityState !== "visible" || video.readyState < 2 || !video.videoWidth) return;
      const w = TRACKING.frameWidth;
      const h = Math.round((w * video.videoHeight) / video.videoWidth);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.drawImage(video, 0, 0, w, h);
      const tsMs = Date.now();
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          buffer.push({ blob, tsMs });
          if (buffer.length > TRACKING.frameMaxBuffered) buffer = buffer.slice(-TRACKING.frameMaxBuffered);
        },
        "image/jpeg",
        TRACKING.frameJpegQuality,
      );
    }, TRACKING.frameCaptureMs);

    const send = window.setInterval(async () => {
      if (sending || buffer.length === 0) return;
      const batch = buffer;
      buffer = [];
      sending = true;
      try {
        await mutateAsync({ sessionId, frames: batch });
      } catch (e) {
        console.warn("[frames] upload failed – batch dropped", e);
      } finally {
        sending = false;
      }
    }, TRACKING.frameBatchMs);

    return () => {
      window.clearInterval(capture);
      window.clearInterval(send);
      video.pause();
      video.srcObject = null;
    };
  }, [sessionId, stream, mutateAsync]);
}
