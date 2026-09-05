import { useNavigate } from "react-router-dom";
import {
  deleteWorkspace,
  updateWorkspace,
  type WorkspaceDetail
} from "../lib/workspaces-api.js";
import { normalizeCatchAllLast } from "../lib/suggest-preview-routes.js";
import { fromRouteRows, type RouteRow } from "./workspace-settings-helpers.js";

export async function saveWorkspaceRoutes(options: {
  workspaceId: string;
  routeRows: RouteRow[];
  setWorkspace: (w: WorkspaceDetail) => void;
}): Promise<WorkspaceDetail> {
  const normalized = normalizeCatchAllLast(fromRouteRows(options.routeRows));
  const updated = await updateWorkspace(options.workspaceId, {
    routes: normalized
  });
  options.setWorkspace(updated);
  return updated;
}

export async function deleteWorkspaceById(options: {
  workspaceId: string;
  workspace: WorkspaceDetail;
  navigate: ReturnType<typeof useNavigate>;
}): Promise<void> {
  await deleteWorkspace(options.workspaceId);
  void options.navigate("/");
}
