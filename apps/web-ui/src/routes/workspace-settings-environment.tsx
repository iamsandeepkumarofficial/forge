import { useEffect, useState } from "react";
import {
  clearWorkspaceEnvironmentDepsCache,
  clearWorkspaceEnvironmentLaunch,
  getWorkspaceEnvironment,
  type WorkspaceEnvironmentStatus
} from "../lib/workspaces-api.js";
import { EnvironmentLaunchCard } from "./workspace-settings-environment-launch.js";
import { EnvironmentCacheCard } from "./workspace-settings-environment-cache.js";

function useEnvironmentStatus(workspaceId: string) {
  const [status, setStatus] = useState<WorkspaceEnvironmentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setStatus(await getWorkspaceEnvironment(workspaceId));
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      try {
        setStatus(await getWorkspaceEnvironment(workspaceId));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return { status, error, setError, reload };
}

export function EnvironmentPanel(options: { workspaceId: string }) {
  const { workspaceId } = options;
  const { status, error, setError, reload } = useEnvironmentStatus(workspaceId);
  const [busy, setBusy] = useState<"launch" | "deps" | null>(null);

  async function onClearLaunch() {
    if (
      !window.confirm(
        "Clear the saved launch.json for this workspace? New chats will scaffold or detect apps again until one starts successfully."
      )
    ) {
      return;
    }
    setBusy("launch");
    setError(null);
    try {
      await clearWorkspaceEnvironmentLaunch(workspaceId);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onClearDeps() {
    if (
      !window.confirm(
        "Clear the shared package cache for this workspace? New chats will reinstall dependencies when lockfiles change or cache is empty."
      )
    ) {
      return;
    }
    setBusy("deps");
    setError(null);
    try {
      await clearWorkspaceEnvironmentDepsCache(workspaceId);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const apps = status?.launch.apps ?? [];

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Environment</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          When a chat starts apps successfully, Forge saves{" "}
          <span className="font-mono">.forge/launch.json</span> here and caches{" "}
          <span className="font-mono">node_modules</span> on a workspace Docker
          volume so the next chat can reuse them.
        </p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <EnvironmentLaunchCard
        apps={apps}
        updatedAt={status?.updatedAt ?? null}
        busy={busy === "launch"}
        anyBusy={busy !== null}
        onClear={() => void onClearLaunch()}
      />
      <EnvironmentCacheCard
        depsVolumeName={status?.depsVolumeName ?? "…"}
        busy={busy === "deps"}
        anyBusy={busy !== null}
        onClear={() => void onClearDeps()}
      />
    </section>
  );
}
