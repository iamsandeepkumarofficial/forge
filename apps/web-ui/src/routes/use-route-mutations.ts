import { useNavigate } from "react-router-dom";
import { toRouteRows, type RouteRow } from "./workspace-settings-helpers.js";
import type { WorkspaceDetail } from "../lib/workspaces-api.js";
import {
  deleteWorkspaceById,
  saveWorkspaceRoutes
} from "./workspace-routes-actions.js";

export function useRouteMutations(options: {
  workspaceId: string;
  workspace: WorkspaceDetail | null;
  routeRows: RouteRow[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  setWorkspace: (w: WorkspaceDetail) => void;
  setRouteRows: (rows: RouteRow[]) => void;
  setRoutesDirty: (v: boolean) => void;
  setRoutesError: (v: string | null) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const onSaveRoutes = () => {
    if (options.busy) return;
    void (async () => {
      options.setBusy(true);
      options.setRoutesError(null);
      try {
        const updated = await saveWorkspaceRoutes({
          workspaceId: options.workspaceId,
          routeRows: options.routeRows,
          setWorkspace: options.setWorkspace
        });
        options.setRouteRows(toRouteRows(updated.routes ?? []));
        options.setRoutesDirty(false);
      } catch (err) {
        options.setRoutesError(
          err instanceof Error ? err.message : String(err)
        );
      } finally {
        options.setBusy(false);
      }
    })();
  };

  const onDelete = () => {
    const workspace = options.workspace;
    if (!workspace || options.busy) return;
    if (!confirm(`Delete workspace "${workspace.name}"?`)) return;
    void (async () => {
      options.setBusy(true);
      options.setError(null);
      try {
        await deleteWorkspaceById({
          workspaceId: options.workspaceId,
          workspace,
          navigate: options.navigate
        });
      } catch (err) {
        options.setError(err instanceof Error ? err.message : String(err));
        options.setBusy(false);
      }
    })();
  };

  return { onSaveRoutes, onDelete };
}
