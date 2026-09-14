import { useState } from "react";
import { toRouteRows, type RouteRow } from "./workspace-settings-helpers.js";
import type { WorkspaceDetail } from "../lib/workspaces-api.js";

export function useRouteRowSync(options: {
  workspace: WorkspaceDetail | null;
  routesDirty: boolean;
  setRouteRows: (rows: RouteRow[]) => void;
}) {
  const routesKey = options.workspace
    ? JSON.stringify(options.workspace.routes ?? [])
    : "";
  const [syncedRoutesKey, setSyncedRoutesKey] = useState("");
  if (
    options.workspace &&
    !options.routesDirty &&
    syncedRoutesKey !== routesKey
  ) {
    setSyncedRoutesKey(routesKey);
    options.setRouteRows(toRouteRows(options.workspace.routes ?? []));
  }
}
