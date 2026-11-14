import type { CsvRow } from "@/types/domain";

export const CSV_COLUMNS = ["session_id", "subject_name", "event", "reel_id", "ts_ms", "t_rel_ms", "value"] as const;

export function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && !Number.isFinite(value)) return ""; // no measurement = empty field
  const s = typeof value === "number" ? (Number.isInteger(value) ? String(value) : value.toFixed(4)) : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Generic serialization of objects to CSV in the given column order. */
export function objectsToCsv<T extends object>(columns: readonly (keyof T)[], rows: readonly T[]): string {
  const out = [columns.join(",")];
  for (const r of rows) out.push(columns.map((c) => escapeCsv(r[c])).join(","));
  return out.join("\n") + "\n";
}

export function rowsToCsv(rows: CsvRow[]): string {
  const lines = rows.map((r) =>
    [r.sessionId, r.subjectName, r.event, r.reelId, r.tsMs, r.tRelMs, r.value].map(escapeCsv).join(","),
  );
  return [CSV_COLUMNS.join(","), ...lines].join("\n") + "\n";
}
