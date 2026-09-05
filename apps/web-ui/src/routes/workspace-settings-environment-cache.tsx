export function EnvironmentCacheCard(options: {
  depsVolumeName: string;
  busy: boolean;
  anyBusy: boolean;
  onClear: () => void;
}) {
  const { depsVolumeName, busy, anyBusy, onClear } = options;
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-medium">Package cache</h4>
          <p className="text-sm text-muted-foreground">
            Docker volume <span className="font-mono">{depsVolumeName}</span>.
            Linked into new chats from the shared cache (even if lockfiles
            drifted slightly); reinstall if a package is still missing.
          </p>
        </div>
        <button
          type="button"
          disabled={anyBusy}
          onClick={onClear}
          className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
        >
          {busy ? "Clearing…" : "Clear package cache"}
        </button>
      </div>
    </div>
  );
}
