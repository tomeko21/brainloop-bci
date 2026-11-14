import { Plug } from "lucide-react";

/** Placeholder shown instead of EEG charts while no headset is streaming (there is no mock data). */
export function NoEegData({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "py-3 text-center" : "grid min-h-40 place-items-center py-6 text-center"}>
      <div>
        {!compact && <Plug className="mx-auto mb-2 size-6 text-muted" />}
        <p className="text-sm font-medium">Connect the EEG headset to see live data</p>
        {!compact && <p className="mt-1 text-xs text-muted">Connect it in BrainAccess Board – it appears here automatically.</p>}
      </div>
    </div>
  );
}
