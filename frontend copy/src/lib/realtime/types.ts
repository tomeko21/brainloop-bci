export type StreamStatus = "connecting" | "open" | "reconnecting" | "closed";

export interface StreamHandle {
  close: () => void;
}

export interface StreamCallbacks<T> {
  onMessage: (msg: T) => void;
  onStatus?: (status: StreamStatus) => void;
}
