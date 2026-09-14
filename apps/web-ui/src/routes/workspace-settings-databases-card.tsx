import { cn } from "@/lib/utils";
import type { WorkspaceDatabaseEngine } from "../lib/workspaces-api.js";

export function DatabasesEngineCard(options: {
  engine: WorkspaceDatabaseEngine;
  busy: boolean;
  onProvision: () => void;
  onDetach: () => void;
}) {
  const { engine, busy, onProvision, onDetach } = options;
  return (
    <div className="space-y-2 rounded-xl border bg-card p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-medium">{engine.label}</h4>
        <span
          className={cn(
            "text-xs",
            engine.attached
              ? "text-green-600"
              : engine.engineRunning
                ? "text-amber-600"
                : "text-muted-foreground"
          )}
        >
          {engine.attached
            ? "attached"
            : engine.engineRunning
              ? "running (shared)"
              : "not running"}
        </span>
      </div>
      <dl className="space-y-1 text-xs text-muted-foreground">
        <div>
          Image{" "}
          <span className="font-mono text-foreground">{engine.image}</span>
        </div>
        <div>
          Sandbox host{" "}
          <span className="font-mono text-foreground">
            {engine.networkAlias}
          </span>
        </div>
        <div>
          Host port{" "}
          <span className="font-mono text-foreground">{engine.hostPort}</span>
        </div>
        <div>
          Injected as{" "}
          <span className="font-mono text-foreground">{engine.envKey}</span>
        </div>
        {engine.database ? (
          <div>
            Database{" "}
            <span className="font-mono text-foreground">{engine.database}</span>
          </div>
        ) : null}
      </dl>
      <div className="flex flex-wrap gap-2 pt-1">
        {!engine.attached ? (
          <button
            type="button"
            disabled={busy}
            onClick={onProvision}
            className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground disabled:opacity-50"
          >
            {busy ? "Provisioning…" : "Provision for workspace"}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={onDetach}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            {busy ? "Detaching…" : "Detach"}
          </button>
        )}
      </div>
    </div>
  );
}
