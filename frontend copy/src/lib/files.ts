// start/end timestamps in the name make it easy to line up with EEG
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

