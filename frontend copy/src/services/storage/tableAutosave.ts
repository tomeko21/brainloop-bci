// Autosave of reel_views, scroll and face to IndexedDB. Each tick appends only new rows as a separate chunk,
// so the cost doesn't grow with session length. After a refresh the tables are rebuilt from the chunks.
import { ALL_TABLES } from "@/services/dataLogger/tables";
import { STORAGE } from "@/config/tuning";
import { usePersistenceStore } from "@/store/persistenceStore";
import { useSessionStore } from "@/store/sessionStore";
import { STORES, idbDeleteBySession, idbGetAllBySession, idbPut } from "./idb";

export const AUTOSAVE_MS = STORAGE.autosaveMs;

interface TableChunk {
  id?: number;
  sessionId: string;
  table: string;
  savedAtMs: number;
  rows: object[];
}

let flushing: Promise<void> | null = null;

const emergencyKey = (sessionId: string) => `brainloop.unsaved.${sessionId}`;

// Sync save on pagehide. Browsers often kill IndexedDB writes during unload, so the last batch goes to
// localStorage and is moved into IndexedDB on restore.
export function saveUnsavedNow(): void {
  const sessionId = useSessionStore.getState().session?.id;
  if (!sessionId) return;
  const key = emergencyKey(sessionId);
  try {
    const prev = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, object[]>;
    for (const table of ALL_TABLES) {
      const rows = table.takeUnsaved() as object[];
      if (rows.length) prev[table.name] = [...(prev[table.name] ?? []), ...rows];
    }
    localStorage.setItem(key, JSON.stringify(prev));
  } catch {
    // out of space, autosave still has everything but the last second
  }
}

export function flushTables(): Promise<void> {
  flushing ??= (async () => {
    const sessionId = useSessionStore.getState().session?.id;
    if (!sessionId) return;
    try {
      for (const table of ALL_TABLES) {
        const rows = table.takeUnsaved() as object[];
        if (!rows.length) continue;
        try {
          await idbPut<TableChunk>(STORES.tableChunks, { sessionId, table: table.name, savedAtMs: Date.now(), rows });
        } catch (e) {
          table.markUnsaved(rows.length);  // retried on the next tick
          throw e;
        }
      }
      usePersistenceStore.getState().patch({ lastSavedAtMs: Date.now(), error: null });
    } catch (e) {
      usePersistenceStore.getState().patch({ error: e instanceof Error ? e.message : "IndexedDB write error" });
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

const restored = new Map<string, Promise<number>>();

// idempotent per session, StrictMode can call it twice
export function restoreTables(sessionId: string): Promise<number> {
  let p = restored.get(sessionId);
  if (!p) {
    p = doRestore(sessionId);
    restored.set(sessionId, p);
  }
  return p;
}

async function doRestore(sessionId: string): Promise<number> {
  const key = emergencyKey(sessionId);
  const emergency = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, object[]>;
  for (const [table, rows] of Object.entries(emergency)) {
    if (rows.length) await idbPut<TableChunk>(STORES.tableChunks, { sessionId, table, savedAtMs: Date.now(), rows });
  }
  localStorage.removeItem(key);

  const chunks = await idbGetAllBySession<TableChunk>(STORES.tableChunks, sessionId);
  chunks.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  let total = 0;
  for (const table of ALL_TABLES) {
    const rows = chunks.filter((c) => c.table === table.name).flatMap((c) => c.rows);
    if (rows.length) (table as { hydrate: (r: object[]) => void }).hydrate(rows);
    total += rows.length;
  }
  return total;
}

export async function deleteSessionTables(sessionId: string): Promise<void> {
  localStorage.removeItem(emergencyKey(sessionId));
  await idbDeleteBySession(STORES.tableChunks, sessionId);
}

export function startTableAutosave(): () => void {
  const id = window.setInterval(() => void flushTables(), AUTOSAVE_MS);
  const onHide = () => {
    if (document.visibilityState === "hidden") void flushTables();
  };
  const onPageHide = () => saveUnsavedNow();
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onPageHide);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", onPageHide);
  };
}
