/**
 * Vite plugin: a "local backend" that writes session data to the data/ folder on the laptop disk.
 * Works only in `npm run dev` (also from a phone via `dev:mobile` - files land on the laptop).
 * Once FastAPI exists, the backend does the same writing and this plugin is no longer used.
 *
 *   POST /__local-data/file?dir=sessions/<folder>&name=<file>   - write the file as-is (CSV, .webm)
 *   POST /__local-data/dataset?table=<table>&session=<id>     - append CSV to data/dataset/<table>.csv
 *   GET  /__local-data/status                                  - whether saving is available
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const SAFE = /^[A-Za-z0-9._-]+$/;

function safeRelPath(p: string): string | null {
  const parts = p.split("/").filter(Boolean);
  if (!parts.length || parts.some((s) => !SAFE.test(s) || s === "." || s === "..")) return null;
  return parts.join("/");
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((res, rej) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => res(Buffer.concat(chunks).toString("utf8")));
    req.on("error", rej);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export function localDataSink(dataDir: string): Plugin {
  const root = resolve(dataDir);
  const datasetDir = join(root, "dataset");
  const indexFile = join(datasetDir, "_appended.json");

  /** Which sessions are already appended to which table - saving the same session again will not duplicate rows. */
  const readIndex = (): Record<string, string[]> => {
    try {
      return JSON.parse(readFileSync(indexFile, "utf8")) as Record<string, string[]>;
    } catch {
      return {};
    }
  };

  return {
    name: "brainloop-local-data-sink",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__local-data", async (req, res) => {
        try {
          const url = new URL(req.url ?? "/", "http://x");

          if (req.method === "GET" && url.pathname === "/status") {
            return json(res, 200, { ok: true, dataDir: root });
          }

          if (req.method === "POST" && url.pathname === "/file") {
            const dir = safeRelPath(url.searchParams.get("dir") ?? "");
            const name = safeRelPath(url.searchParams.get("name") ?? "");
            if (!dir || !name || name.includes("/")) return json(res, 400, { error: "Invalid path" });
            const target = join(root, dir, name);
            mkdirSync(dirname(target), { recursive: true });
            await new Promise<void>((ok, fail) => {
              const out = createWriteStream(target);
              req.pipe(out);
              out.on("finish", ok);
              out.on("error", fail);
              req.on("error", fail);
            });
            return json(res, 200, { path: relative(resolve(root, ".."), target) });
          }

          if (req.method === "POST" && url.pathname === "/dataset") {
            const table = url.searchParams.get("table") ?? "";
            const session = url.searchParams.get("session") ?? "";
            if (!SAFE.test(table) || !SAFE.test(session)) return json(res, 400, { error: "Invalid parameters" });
            const csv = (await readBody(req)).trimEnd();
            const [header, ...rows] = csv.split("\n");
            mkdirSync(datasetDir, { recursive: true });

            const index = readIndex();
            if (index[table]?.includes(session)) return json(res, 200, { skipped: true, reason: "session already appended" });

            let file = join(datasetDir, `${table}.csv`);
            if (existsSync(file)) {
              const existingHeader = readFileSync(file, "utf8").split("\n", 1)[0];
              // Column format changed -> new file instead of corrupting the old one
              if (existingHeader !== header) file = join(datasetDir, `${table}__${Buffer.from(header).toString("base64url").slice(0, 8)}.csv`);
            }
            if (!existsSync(file)) writeFileSync(file, header + "\n");
            if (rows.length) appendFileSync(file, rows.join("\n") + "\n");

            index[table] = [...(index[table] ?? []), session];
            writeFileSync(indexFile, JSON.stringify(index, null, 2));
            return json(res, 200, { path: relative(resolve(root, ".."), file), appended: rows.length });
          }

          json(res, 404, { error: "Unknown endpoint" });
        } catch (e) {
          json(res, 500, { error: e instanceof Error ? e.message : String(e) });
        }
      });
    },
  };
}
