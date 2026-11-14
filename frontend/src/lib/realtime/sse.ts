import type { StreamCallbacks, StreamHandle } from "./types";

/**
 * Server-Sent Events – maps 1:1 to FastAPI `StreamingResponse` with a `yield` generator:
 *   yield f"data: {json.dumps(snapshot)}\n\n"
 * EventSource reconnects on its own after a drop.
 */
export function connectSse<T>(url: string, { onMessage, onStatus }: StreamCallbacks<T>): StreamHandle {
  onStatus?.("connecting");
  const es = new EventSource(url);
  es.onopen = () => onStatus?.("open");
  es.onerror = () => onStatus?.(es.readyState === EventSource.CLOSED ? "closed" : "reconnecting");
  es.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data) as T);
    } catch {
      console.warn("[sse] invalid JSON", e.data);
    }
  };
  return {
    close: () => {
      es.close();
      onStatus?.("closed");
    },
  };
}
