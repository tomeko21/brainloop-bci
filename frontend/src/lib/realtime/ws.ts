import type { StreamCallbacks, StreamHandle } from "./types";

/** WebSocket z auto-reconnectem (exponential backoff 0.5 s -> 8 s). */
export function connectWs<T>(url: string, { onMessage, onStatus }: StreamCallbacks<T>): StreamHandle {
  let ws: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let retryTimer: number | null = null;

  const open = () => {
    onStatus?.(attempt === 0 ? "connecting" : "reconnecting");
    ws = new WebSocket(url);
    ws.onopen = () => {
      attempt = 0;
      onStatus?.("open");
    };
    ws.onmessage = (e) => {
      try {
        onMessage(JSON.parse(e.data as string) as T);
      } catch {
        console.warn("[ws] niepoprawny JSON", e.data);
      }
    };
    ws.onclose = () => {
      if (closed) return;
      attempt++;
      onStatus?.("reconnecting");
      retryTimer = window.setTimeout(open, Math.min(8_000, 500 * 2 ** attempt));
    };
  };
  open();

  return {
    close: () => {
      closed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      ws?.close();
      onStatus?.("closed");
    },
  };
}
