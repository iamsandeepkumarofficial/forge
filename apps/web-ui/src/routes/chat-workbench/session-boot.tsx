import { Loader2 } from "lucide-react";
import type { SandboxStatus } from "./types.js";

export async function bootExistingOrStartSession(options: {
  sessionId: string;
  getStatus: (sessionId: string) => Promise<{ status?: string }>;
  start: (sessionId: string) => Promise<unknown>;
  setStatus: (status: SandboxStatus) => void;
}): Promise<void> {
  const { sessionId, getStatus, start, setStatus } = options;
  let alreadyReady = false;
  try {
    const st = await getStatus(sessionId);
    if (st.status === "ready") {
      alreadyReady = true;
      setStatus("ready");
    } else {
      setStatus("starting");
    }
  } catch {
    setStatus("starting");
  }
  try {
    await start(sessionId);
    setStatus("ready");
  } catch (err) {
    console.error("Failed to start session sandbox:", err);
    if (!alreadyReady) setStatus("error");
  }
}

export function sessionBootCopyProps(options: {
  copying: boolean;
  copyError: string | null;
  retryCopy: () => void;
  sandboxStatus: SandboxStatus;
  startSandbox: () => void;
}): {
  sandboxStatus: SandboxStatus;
  title?: string;
  detail?: string;
  onRetry?: () => void;
} {
  if (options.copyError) {
    return {
      sandboxStatus: "error",
      title: "Could not branch this chat",
      detail: options.copyError,
      onRetry: options.retryCopy
    };
  }
  if (options.copying) {
    return {
      sandboxStatus: "starting",
      title: "Copying workspace…",
      detail:
        "Copying files into this session so you can keep working from that message."
    };
  }
  return {
    sandboxStatus: options.sandboxStatus === "error" ? "error" : "starting",
    onRetry:
      options.sandboxStatus === "error" ? options.startSandbox : undefined
  };
}

export function SessionBootScreen(options: {
  sandboxStatus: SandboxStatus;
  onRetry?: () => void;
  title?: string;
  detail?: string;
}) {
  const { sandboxStatus, onRetry } = options;
  if (sandboxStatus === "error") {
    return (
      <div className="grid h-full place-items-center px-6">
        <div className="max-w-sm text-center">
          <p className="text-sm font-medium">
            {options.title ?? "Workspace failed to start"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {options.detail ??
              "The sandbox did not finish initializing. Retry, or leave and open the chat again."}
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
        <p className="text-sm font-medium">
          {options.title ?? "Initializing workspace…"}
        </p>
        <p className="text-sm text-muted-foreground">
          {options.detail ??
            "Provisioning the sandbox and restoring dependencies. This stays up until the workspace is ready."}
        </p>
      </div>
    </div>
  );
}
