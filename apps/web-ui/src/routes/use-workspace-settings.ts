import {
  useWorkspaceHealthSettings,
  useSettingsTab
} from "./use-workspace-health-settings.js";
import { useWorkspaceMembersSettings } from "./use-workspace-members-settings.js";
import { useWorkspaceRoutesSettings } from "./use-workspace-routes-settings.js";
import type { WorkspaceDetail } from "../lib/workspaces-api.js";
import type { ProjectSummary } from "../lib/projects-api.js";

export function useWorkspaceSettings(options: {
  workspaceId: string;
  workspace: WorkspaceDetail | null;
  projects: ProjectSummary[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  setWorkspace: (w: WorkspaceDetail) => void;
}) {
  const {
    workspaceId,
    workspace,
    projects,
    busy,
    setBusy,
    setError,
    setWorkspace
  } = options;

  const health = useWorkspaceHealthSettings(
    workspaceId,
    workspace?.members.length ?? 0
  );
  const tab = useSettingsTab();
  const routes = useWorkspaceRoutesSettings({
    workspaceId,
    workspace,
    busy,
    setBusy,
    setError,
    setWorkspace
  });
  const members = useWorkspaceMembersSettings({
    workspaceId,
    workspace,
    projects,
    busy,
    setBusy,
    setWorkspace,
    onRoutesSuggested: routes.applySuggestedFromMembers
  });

  const onRemoveMember = (projectId: string) => {
    routes.resetRoutesDirty();
    members.onRemoveMember(projectId);
  };

  return {
    ...health,
    ...tab,
    ...members,
    ...routes,
    onRemoveMember
  };
}
