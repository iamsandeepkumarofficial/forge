import type { AppStatus } from "../../lib/tool-runner.js";

export function EmptyPreview({ onOpenRun }: { onOpenRun?: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-medium">No preview yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Start a web app on ports 3000–3009 and it will show up here. If start
        fails, check the app log tab in Terminal for crash output.
      </p>
      {onOpenRun ? (
        <button
          type="button"
          onClick={onOpenRun}
          className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background"
        >
          Start an app
        </button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Open <span className="font-medium">Run</span> and start one.
        </p>
      )}
    </div>
  );
}
export function MissingPreviewUrl({ ports }: { ports: AppStatus[] }) {
  const label = ports
    .map((a) => (a.port != null ? `:${a.port}` : a.name))
    .join(", ");
  return (
    <p className="p-4 text-sm text-muted-foreground">
      App is running inside the sandbox ({label}) but has no preview URL. Forge
      only publishes ports <span className="font-medium">3000–3009</span>. Set
      the app port in <span className="font-medium">.forge/launch.json</span> to
      that range, stop the app in Run, then start it again.
    </p>
  );
}
