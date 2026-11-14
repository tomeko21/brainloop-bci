/** Animated, blurred "blobs" of light + grid – futuristic background for the whole app. */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div className="absolute -left-[15%] -top-[20%] size-[60vmax] animate-float-slow rounded-full bg-neon-violet/20 blur-[120px]" />
      <div className="absolute -bottom-[25%] -right-[10%] size-[55vmax] animate-float-slow rounded-full bg-neon-cyan/15 blur-[120px] [animation-delay:-5s]" />
      <div className="absolute left-[40%] top-[45%] size-[30vmax] animate-float-slow rounded-full bg-neon-pink/10 blur-[110px] [animation-delay:-9s]" />
    </div>
  );
}
