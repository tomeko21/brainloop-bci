import { AnimatePresence, motion } from "motion/react";
import { FolderCheck, PackageOpen, X } from "lucide-react";
import { useSessionStore } from "@/store/sessionStore";
import { formatTime } from "@/lib/format";

/** After the session ends: where the data was saved. */
export function LastExportNotice() {
  const last = useSessionStore((s) => s.lastExport);
  const clear = useSessionStore((s) => s.setLastExport);

  return (
    <AnimatePresence>
      {last && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="glass flex w-full max-w-md items-start gap-3 rounded-2xl p-4"
        >
          {last.savedTo ? <FolderCheck className="mt-0.5 size-5 shrink-0 text-ok" /> : <PackageOpen className="mt-0.5 size-5 shrink-0 text-warn" />}
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">
              Session "{last.subjectName}" saved · {formatTime(last.atMs)}
            </p>
            {last.savedTo ? (
              <>
                <p className="mt-1 break-all font-mono text-xs text-muted">{last.savedTo}/</p>
                <p className="mt-1 text-xs text-muted">
                  + appended {last.datasetRows} rows to <span className="font-mono">data/dataset/</span>
                  {last.zipDownloaded && " · ZIP downloaded too"}
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-muted">Saving to data/ unavailable – data downloaded as ZIP (Downloads folder).</p>
            )}
          </div>
          <button type="button" onClick={() => clear(null)} aria-label="Close" className="cursor-pointer text-muted hover:text-fg">
            <X className="size-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
