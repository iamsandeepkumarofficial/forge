import { useEffect, useState } from "react";
import {
  detachWorkspaceDatabase,
  getWorkspaceDatabases,
  provisionWorkspaceDatabase,
  type WorkspaceDatabaseEngine,
  type WorkspaceDatabaseStatus
} from "../lib/workspaces-api.js";
import { DatabasesEngineCard } from "./workspace-settings-databases-card.js";

function useDatabasesStatus(workspaceId: string, setupBusy: boolean) {
  const [status, setStatus] = useState<WorkspaceDatabaseStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setStatus(await getWorkspaceDatabases(workspaceId));
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      try {
        setStatus(await getWorkspaceDatabases(workspaceId));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, setupBusy]);

  return { status, error, setError, reload };
}

function DatabasesHeader(options: {
  setupBusy: boolean;
  setupCtaLabel: string;
  onSetupCta: () => void;
}) {
  const { setupBusy, setupCtaLabel, onSetupCta } = options;
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <h3 className="text-lg font-semibold">Databases</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Nothing starts by default. Provision an engine and Forge reuses one
          shared container on docker network{" "}
          <span className="font-mono">forge</span> (pulls the image if needed).
          Each workspace gets its own database name on that server. Analyze only
          reports infra shadows — provision here or via the setup agent after
          you approve.
        </p>
      </div>
      <button
        type="button"
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        disabled={setupBusy}
        onClick={onSetupCta}
      >
        {setupBusy
          ? setupCtaLabel === "Fix"
            ? "Fixing…"
            : "Analyzing…"
          : setupCtaLabel}
      </button>
    </div>
  );
}

export function DatabasesPanel(options: {
  workspaceId: string;
  onSetupCta: () => void;
  setupBusy: boolean;
  setupCtaLabel: string;
}) {
  const { workspaceId, onSetupCta, setupBusy, setupCtaLabel } = options;
  const { status, error, setError, reload } = useDatabasesStatus(
    workspaceId,
    setupBusy
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  async function onProvision(engineId: "postgres" | "mongo") {
    setBusyId(engineId);
    setError(null);
    try {
      await provisionWorkspaceDatabase(workspaceId, engineId);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function onDetach(engineId: "postgres" | "mongo") {
    setBusyId(engineId);
    setError(null);
    try {
      await detachWorkspaceDatabase(workspaceId, engineId);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-4">
      <DatabasesHeader
        setupBusy={setupBusy}
        setupCtaLabel={setupCtaLabel}
        onSetupCta={onSetupCta}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {status && !status.enabled ? (
        <p className="text-sm text-muted-foreground">
          App databases are disabled (`FORGE_APP_DB_ENABLED=0`).
        </p>
      ) : null}
      {status ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {status.engines.map((engine: WorkspaceDatabaseEngine) => (
            <DatabasesEngineCard
              key={engine.id}
              engine={engine}
              busy={busyId === engine.id}
              onProvision={() => void onProvision(engine.id)}
              onDetach={() => void onDetach(engine.id)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
