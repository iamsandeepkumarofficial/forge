import { useCallback, useEffect, useState } from "react";
import {
  getWorkspace,
  type WorkspaceDetail
} from "../lib/workspaces-api.js";
import {
  fetchProjects,
  type ProjectSummary
} from "../lib/projects-api.js";

export type UseWorkspaceState = {
  workspaceId: string;
  workspace: WorkspaceDetail | null;
  projects: ProjectSummary[];
  error: string | null;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  setWorkspace: (ws: WorkspaceDetail) => void;
  reload: () => Promise<WorkspaceDetail | null>;
};

export function useWorkspace(workspaceId: string): UseWorkspaceState {
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!workspaceId) return null;
    const detail = await getWorkspace(workspaceId);
    setWorkspace(detail);
    return detail;
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    void (async () => {
      try {
        const detail = await getWorkspace(workspaceId);
        if (cancelled) return;
        setWorkspace(detail);
        try {
          const rows = await fetchProjects();
          if (!cancelled) setProjects(Array.isArray(rows) ? rows : []);
        } catch {
          if (!cancelled) setProjects([]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return {
    workspaceId,
    workspace,
    projects,
    error,
    busy,
    setBusy,
    setError,
    setWorkspace,
    reload
  };
}
