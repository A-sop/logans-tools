'use client';

export default function DabosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border p-6">
      <h2 className="text-lg font-semibold">This DABOS page failed to render</h2>
      <p className="text-sm text-muted-foreground">{error.message || 'Unknown error'}</p>
      <button
        type="button"
        className="rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
        onClick={() => reset()}
      >
        Retry
      </button>
    </div>
  );
}
