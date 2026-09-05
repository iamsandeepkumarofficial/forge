import { useState } from "react";
import type { WorkspaceDetail } from "../lib/workspaces-api.js";
import type { ProjectSummary } from "../lib/projects-api.js";
import { useMemberSelection } from "./use-member-selection.js";
import { useMemberMutations } from "./use-member-mutations.js";

export function useWorkspaceMembersSettings(options: {
  workspaceId: string;
  workspace: WorkspaceDetail | null;
  projects: ProjectSummary[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  setWorkspace: (w: WorkspaceDetail) => void;
  onRoutesSuggested: () => void;
}) {
  const selection = useMemberSelection({
    workspace: options.workspace,
    projects: options.projects
  });
  const [membersError, setMembersError] = useState<string | null>(null);
  const [editingDepends, setEditingDepends] = useState<string | null>(null);
  const mutations = useMemberMutations({
    workspaceId: options.workspaceId,
    workspace: options.workspace,
    busy: options.busy,
    selectedIds: selection.selectedIds,
    setBusy: options.setBusy,
    setWorkspace: options.setWorkspace,
    setMembersError,
    setEditingDepends,
    setSelectedIds: selection.setSelectedIds,
    onRoutesSuggested: options.onRoutesSuggested
  });
  return {
    selectedIds: selection.selectedIds,
    available: selection.available,
    membersError,
    editingDepends,
    setEditingDepends,
    toggleSelected: selection.toggleSelected,
    onAddSelected: mutations.onAddSelected,
    onRemoveMember: mutations.onRemoveMember,
    onSaveDepends: mutations.onSaveDepends
  };
}
