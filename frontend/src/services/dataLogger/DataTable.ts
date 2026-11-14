import { objectsToCsv } from "@/lib/csv";

/**
 * In-memory table for high-frequency data (face, scroll).
 * We do NOT keep it in Zustand/localStorage - serializing every 100 ms would kill performance.
 * The UI gets only the row count, refreshed at most once per second.
 */
export class DataTable<T extends object> {
  private rows: T[] = [];
  /** Index of the first row whose data is not yet saved to IndexedDB. */
  private savedUpTo = 0;
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

  /** Rows added since the last autosave (and mark them as saved). */
  takeUnsaved(): T[] {
    const out = this.rows.slice(this.savedUpTo);
    this.savedUpTo = this.rows.length;
    return out;
  }

  /** Undo the marking when the save failed. */
  markUnsaved(count: number): void {
    this.savedUpTo = Math.max(0, this.savedUpTo - count);
  }

  /**
   * Prepend rows restored from IndexedDB (already saved).
   * Rows added in the meantime stay at the end and still await saving.
   */
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

  /** For useSyncExternalStore. */
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
