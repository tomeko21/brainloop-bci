import { useEffect } from "react";
import { restoreTables, startTableAutosave } from "@/services/storage/tableAutosave";
import { countSegments } from "@/services/storage/videoStore";
import { usePersistenceStore } from "@/store/persistenceStore";
import { selectIsActive, useSessionStore } from "@/store/sessionStore";

/**
 * On app start: if a session is in progress (e.g. after a page refresh),
 * restore the tables from IndexedDB, and only then enable autosave.
 */
export function DataBootstrap() {
  const sessionId = useSessionStore((s) => (selectIsActive(s) ? s.session!.id : null));

  useEffect(() => {
    if (!sessionId) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      try {
        const [rows, segments] = await Promise.all([restoreTables(sessionId), countSegments(sessionId)]);
        usePersistenceStore.getState().patch({ restoredRows: rows, restoredSegments: segments });
      } catch (e) {
        usePersistenceStore.getState().patch({ error: e instanceof Error ? e.message : "Failed to read IndexedDB" });
      }
      if (!cancelled) stop = startTableAutosave();
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [sessionId]);

  return null;
}
