import type { StreamCallbacks, StreamHandle } from "./types";

// Matches a FastAPI StreamingResponse that yields "data: {json}\n\n". EventSource reconnects on its own.
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
