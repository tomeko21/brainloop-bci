// In-memory table for high-rate data (face, scroll). Kept out of zustand on purpose, serializing every 100 ms
// was too slow. The UI only sees the row count, refreshed at most once per second.
import { objectsToCsv } from "@/lib/csv";

export class DataTable<T extends object> {
  private rows: T[] = [];
  private savedUpTo = 0;  // rows before this index are already in IndexedDB
  private listeners = new Set<() => void>();
  private notifyTimer: number | null = null;
  private readonly tableName: string;
  private readonly columns: readonly (keyof T)[];

  constructor(name: string, columns: readonly (keyof T)[]) {
    this.tableName = name;
    this.columns = columns;
  }

  get name() {
    return this.tableName;
  }

  get fileName() {
    return `${this.tableName}.csv`;
  }

  append(row: T): void {
    this.rows.push(row);
    this.scheduleNotify();
  }

  clear(): void {
    this.rows = [];
    this.savedUpTo = 0;
    this.scheduleNotify();
  }

  takeUnsaved(): T[] {
    const out = this.rows.slice(this.savedUpTo);
    this.savedUpTo = this.rows.length;
    return out;
  }

  markUnsaved(count: number): void {
    this.savedUpTo = Math.max(0, this.savedUpTo - count);
  }

  // prepend rows restored from IndexedDB, rows added meanwhile stay unsaved
  hydrate(restored: T[]): void {
    this.rows = [...restored, ...this.rows];
    this.savedUpTo = restored.length;
    this.scheduleNotify();
  }

  get count(): number {
    return this.rows.length;
  }

  snapshot(): readonly T[] {
    return this.rows;
  }

  toCsv(filter?: (row: T) => boolean): string {
    return objectsToCsv(this.columns, filter ? this.rows.filter(filter) : this.rows);
  }

  // for useSyncExternalStore
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  getCount = () => this.rows.length;

  private scheduleNotify() {
    if (this.notifyTimer !== null) return;
    this.notifyTimer = window.setTimeout(() => {
      this.notifyTimer = null;
      this.listeners.forEach((l) => l());
    }, 1_000);
  }
}
