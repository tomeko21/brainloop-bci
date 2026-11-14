/**
 * ============================================================
 *  "LOCAL BACKEND" – writes to the data/ folder via the Vite server
 * ============================================================
 * Instead of faking an upload, the mocks send files to the vite/localDataSink.ts plugin,
 * which saves them on the laptop's disk. Works only in `npm run dev` / `dev:mobile`;
 * in a production build it returns null (then the ZIP download remains).
 */
const BASE = "/__local-data";

export async function localStatus(): Promise<{ dataDir: string } | null> {
  try {
    const res = await fetch(`${BASE}/status`);
    return res.ok ? ((await res.json()) as { dataDir: string }) : null;
  } catch {
    return null;
  }
}

/** Save a file to data/<dir>/<name>. Returns the path or null. */
export async function saveFileLocal(dir: string, name: string, body: Blob | string): Promise<string | null> {
  try {
    const q = new URLSearchParams({ dir, name });
    const res = await fetch(`${BASE}/file?${q}`, { method: "POST", body });
    if (!res.ok) return null;
    return ((await res.json()) as { path: string }).path;
  } catch {
    return null;
  }
}

/** Append the session CSV to data/dataset/<table>.csv (the server skips sessions already appended). */
export async function appendDatasetLocal(table: string, sessionId: string, csv: string): Promise<number | "skipped" | null> {
  try {
    const q = new URLSearchParams({ table, session: sessionId });
    const res = await fetch(`${BASE}/dataset?${q}`, { method: "POST", body: csv });
    if (!res.ok) return null;
    const out = (await res.json()) as { appended?: number; skipped?: boolean };
    return out.skipped ? "skipped" : (out.appended ?? 0);
  } catch {
    return null;
  }
}
