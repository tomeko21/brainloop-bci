import { useSyncExternalStore } from "react";

interface CountSource {
  subscribe: (listener: () => void) => () => void;
  getCount: () => number;
}

/** In-memory table row count (refreshed at most 1x/s). */
export function useTableCount(table: CountSource): number {
  return useSyncExternalStore(table.subscribe, table.getCount);
}
