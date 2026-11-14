/**
 * Minimal IndexedDB wrapper (no dependencies).
 * Holds session data that does not fit in localStorage: CSV tables and video chunks.
 */
const DB_NAME = "brainloop-data";
const DB_VERSION = 1;

export const STORES = {
  tableChunks: "tableChunks",
  videoChunks: "videoChunks",
  segments: "segments",
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const t = db.createObjectStore(STORES.tableChunks, { keyPath: "id", autoIncrement: true });
      t.createIndex("sessionId", "sessionId");
      const v = db.createObjectStore(STORES.videoChunks, { keyPath: "id", autoIncrement: true });
      v.createIndex("sessionId", "sessionId");
      const s = db.createObjectStore(STORES.segments, { keyPath: ["sessionId", "segment"] });
      s.createIndex("sessionId", "sessionId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

export async function idbPut<T>(store: string, value: T): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).put(value);
  await done(tx);
}

export async function idbGetAllBySession<T>(store: string, sessionId: string): Promise<T[]> {
  const db = await openDb();
  const tx = db.transaction(store, "readonly");
  const req = tx.objectStore(store).index("sessionId").getAll(IDBKeyRange.only(sessionId));
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function idbDeleteBySession(store: string, sessionId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, "readwrite");
  const req = tx.objectStore(store).index("sessionId").openKeyCursor(IDBKeyRange.only(sessionId));
  req.onsuccess = () => {
    const cursor = req.result;
    if (!cursor) return;
    tx.objectStore(store).delete(cursor.primaryKey);
    cursor.continue();
  };
  await done(tx);
}
