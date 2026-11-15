import { useSyncExternalStore } from "react";

interface CountSource {
  subscribe: (listener: () => void) => () => void;
  getCount: () => number;
}

export function useTableCount(table: CountSource): number {
  return useSyncExternalStore(table.subscribe, table.getCount);
}
