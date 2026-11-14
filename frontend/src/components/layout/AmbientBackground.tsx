/**
 * Static "futuristic" background: soft colour glows + grid.
 * Deliberately NOT animated and without CSS blur filters – a moving blurred background makes every
 * glass card (backdrop-filter) re-blur on every frame, which made the whole app lag.
 */
export function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        background:
          "radial-gradient(60vmax 60vmax at 0% 0%, rgb(167 139 250 / 0.16), transparent 60%)," +
          "radial-gradient(55vmax 55vmax at 100% 100%, rgb(34 211 238 / 0.12), transparent 60%)," +
          "radial-gradient(35vmax 35vmax at 60% 55%, rgb(244 114 182 / 0.07), transparent 60%)",
      }}
    >
      <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
    </div>
  );
}
