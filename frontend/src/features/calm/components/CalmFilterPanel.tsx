import { CALM_FILTER, calmEffect } from "@/config/calmFilter";
import { useCalmStore } from "@/store/calmStore";
import { useMlStore } from "@/store/mlStore";
import { bestBri } from "@/types/domain";

/** Live view of the calm filter + a preview slider (to demo the effect without a real dopamine peak). */
export function CalmFilterPanel() {
  const intensity = useCalmStore((s) => Math.round(s.intensity * 100) / 100);
  const preview = useCalmStore((s) => s.preview);
  const set = useCalmStore((s) => s.set);
  const bri = useMlStore((s) => bestBri(s.prediction));
  const briSource = useMlStore((s) => (s.prediction?.bri != null ? "camera" : s.prediction?.briEeg != null ? "EEG" : null));
  const e = calmEffect(intensity);

  return (
    <div className="mx-3 mb-2 rounded-xl bg-surface p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-muted">
          Now <b className="text-fg">{Math.round(intensity * 100)}%</b>
          {preview === null ? ` · BRI ${bri === null ? "— (connect the EEG headset)" : `${Math.round(bri)} from ${briSource}`} (on after ${CALM_FILTER.onsetDelayMs / 1000} s at ≥ ${CALM_FILTER.briThreshold}, full at ${CALM_FILTER.briFull})` : " · preview"}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-strong">
        <div className="h-full rounded-full bg-ok transition-[width] duration-300" style={{ width: `${intensity * 100}%` }} />
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1 font-mono text-[10px] text-muted">
        <span>colour {Math.round(e.saturation * 100)}%</span>
        <span>contrast {Math.round(e.contrast * 100)}%</span>
        <span>speed {e.playbackRate.toFixed(2)}×</span>
        <span>volume {Math.round(e.volume * 100)}%</span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="shrink-0 text-muted">Preview</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round((preview ?? intensity) * 100)}
          onChange={(ev) => set({ preview: Number(ev.target.value) / 100 })}
          className="h-1 flex-1 cursor-pointer accent-[var(--color-ok)]"
          aria-label="Preview calm filter intensity"
        />
        <button
          type="button"
          disabled={preview === null}
          onClick={() => set({ preview: null })}
          className="cursor-pointer rounded-md bg-surface-strong px-2 py-1 disabled:cursor-default disabled:opacity-40"
        >
          Auto
        </button>
      </div>
    </div>
  );
}
