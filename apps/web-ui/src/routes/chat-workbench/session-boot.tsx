import { Loader2 } from "lucide-react";
import type { SandboxStatus } from "./types.js";

export function SessionBootScreen(options: {
  sandboxStatus: SandboxStatus;
  onRetry?: () => void;
}) {
  const { sandboxStatus, onRetry } = options;
  if (sandboxStatus === "error") {
    return (
      <div className="grid h-full place-items-center px-6">
        <div className="max-w-sm text-center">
          <p className="text-sm font-medium">Workspace failed to start</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The sandbox did not finish initializing. Retry, or leave and open
            the chat again.
          </p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background"
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>
    );
  }
  return (
    <div className="grid h-full place-items-center px-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm font-medium">Initializing workspace…</p>
        <p className="text-sm text-muted-foreground">
          Provisioning the sandbox, restoring dependencies, and starting apps.
          This stays up until the workspace is ready.
        </p>
      </div>
    </div>
  );
}
