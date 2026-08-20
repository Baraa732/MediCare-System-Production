export function RouteFallback({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex h-screen w-screen items-center justify-center auth-canvas">
      <div className="surface-card px-8 py-6 text-center">
        <div className="mx-auto mb-4 h-10 w-10 rounded-full shimmer" />
        <p className="text-sm font-medium text-neutral-600">{label}</p>
      </div>
    </div>
  );
}
