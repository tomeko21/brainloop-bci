import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/** Attaches a MediaStream to <video>. Mirrored like a selfie. */
export function CameraPreview({ stream, className }: { stream: MediaStream | null; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay muted playsInline className={cn("h-full w-full -scale-x-100 object-cover", className)} />;
}
