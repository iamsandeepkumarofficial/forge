import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { suggestPreviewRoutes } from "../lib/suggest-preview-routes.js";
import { toRouteRows, type RouteRow } from "./workspace-settings-helpers.js";
import type { WorkspaceDetail } from "../lib/workspaces-api.js";
import { useRouteRowSync } from "./use-route-row-sync.js";
import { useRouteMutations } from "./use-route-mutations.js";
import {
  useRouteRowEdits,
  useRoutesDirtyState
} from "./use-route-row-edits.js";

export function useWorkspaceRoutesSettings(options: {
  workspaceId: string;
  workspace: WorkspaceDetail | null;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  setWorkspace: (w: WorkspaceDetail) => void;
}) {
  const navigate = useNavigate();
  const [routeRows, setRouteRows] = useState<RouteRow[]>([]);
  const dirty = useRoutesDirtyState();
  useRouteRowSync({
    workspace: options.workspace,
    routesDirty: dirty.routesDirty,
    setRouteRows
  });
  const suggestedRoutes = useMemo(
    () =>
      options.workspace && options.workspace.members.length > 0
        ? suggestPreviewRoutes(options.workspace.members)
        : [],
    [options.workspace]
  );
  const applySuggestedRoutes = () => {
    if (suggestedRoutes.length === 0) return;
    setRouteRows(toRouteRows(suggestedRoutes));
    dirty.markDirty();
  };
  const applySuggestedFromMembers = () => {
    if (!options.workspace || options.workspace.members.length === 0) return;
    setRouteRows(toRouteRows(suggestPreviewRoutes(options.workspace.members)));
    dirty.markDirty();
  };
  const edits = useRouteRowEdits(dirty.markDirty, setRouteRows);
  const mutations = useRouteMutations({
    workspaceId: options.workspaceId,
    workspace: options.workspace,
    routeRows,
    busy: options.busy,
    setBusy: options.setBusy,
    setError: options.setError,
    setWorkspace: options.setWorkspace,
    setRouteRows,
    setRoutesDirty: dirty.setRoutesDirty,
    setRoutesError: dirty.setRoutesError,
    navigate
  });
  return {
    routeRows,
    routesDirty: dirty.routesDirty,
    routesError: dirty.routesError,
    suggestedRoutes,
    applySuggestedRoutes,
    applySuggestedFromMembers,
    ...edits,
    onSaveRoutes: mutations.onSaveRoutes,
    onDelete: mutations.onDelete,
    resetRoutesDirty: () => dirty.setRoutesDirty(false)
  };
}
