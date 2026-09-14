import type {
  WorkspaceDetail,
  WorkspaceMember
} from "../lib/workspaces-api.js";
import {
  addSelectedProjects,
  removeProjectMember,
  saveMemberDepends
} from "./workspace-members-actions.js";

export function useMemberMutations(options: {
  workspaceId: string;
  workspace: WorkspaceDetail | null;
  busy: boolean;
  selectedIds: Set<string>;
  setBusy: (v: boolean) => void;
  setWorkspace: (w: WorkspaceDetail) => void;
  setMembersError: (v: string | null) => void;
  setEditingDepends: (v: string | null) => void;
  setSelectedIds: (v: Set<string>) => void;
  onRoutesSuggested: () => void;
}) {
  const run = async (fn: () => Promise<void>) => {
    options.setBusy(true);
    options.setMembersError(null);
    try {
      await fn();
    } catch (err) {
      options.setMembersError(err instanceof Error ? err.message : String(err));
    } finally {
      options.setBusy(false);
    }
  };

  const onAddSelected = () => {
    if (options.selectedIds.size === 0 || options.busy) return;
    void run(async () => {
      const latest = await addSelectedProjects({
        workspaceId: options.workspaceId,
        workspace: options.workspace,
        selectedIds: options.selectedIds,
        setWorkspace: options.setWorkspace
      });
      if (
        latest &&
        (latest.routes ?? []).length === 0 &&
        latest.members.length > 0
      ) {
        options.onRoutesSuggested();
      }
      options.setSelectedIds(new Set());
    });
  };

  const onRemoveMember = (projectId: string) => {
    if (options.busy) return;
    void run(async () => {
      await removeProjectMember({
        workspaceId: options.workspaceId,
        projectId,
        setWorkspace: options.setWorkspace
      });
    });
  };

  const onSaveDepends = (member: WorkspaceMember, dependsOn: string[]) => {
    if (options.busy) return;
    void run(async () => {
      await saveMemberDepends({
        workspaceId: options.workspaceId,
        member,
        dependsOn,
        setWorkspace: options.setWorkspace
      });
      options.setEditingDepends(null);
    });
  };

  return { onAddSelected, onRemoveMember, onSaveDepends };
}
