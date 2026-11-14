/** Recording file name contains start/end timestamps - easy to sync with EEG. */
export function recordingFileName(sessionId: string, startedAtMs: number, endedAtMs: number, ext = "webm"): string {
  return `recording_${sessionId}_${startedAtMs}_${endedAtMs}.${ext}`;
}

export function csvFileName(sessionId: string | null): string {
  return `brainloop_${sessionId ?? "all"}_${Date.now()}.csv`;
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function downloadText(text: string, fileName: string, mime = "text/csv;charset=utf-8"): void {
  downloadBlob(new Blob([text], { type: mime }), fileName);
}

/** "Łukasz Ż." -> "lukasz-z" (safe in a folder name). */
export function slug(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "anon";
}

/**
 * Session folder in data/sessions/: start date and time + person + id.
 * Each session has its own folder -> later sessions are added, never overwritten.
 */
export function sessionFolderName(session: { id: string; subjectName: string; startedAtMs: number }): string {
  const d = new Date(session.startedAtMs);
  const p = (n: number) => String(n).padStart(2, "0");
  const stampStr = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`;
  return `${stampStr}_${slug(session.subjectName)}_${session.id}`;
}
