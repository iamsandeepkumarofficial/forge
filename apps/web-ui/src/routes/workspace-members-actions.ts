import {
  addWorkspaceProject,
  removeWorkspaceProject,
  updateWorkspaceProject,
  type WorkspaceDetail,
  type WorkspaceMember
} from "../lib/workspaces-api.js";

export async function addSelectedProjects(options: {
  workspaceId: string;
  workspace: WorkspaceDetail | null;
  selectedIds: Set<string>;
  setWorkspace: (w: WorkspaceDetail) => void;
}): Promise<WorkspaceDetail | null> {
  let latest = options.workspace;
  for (const projectId of options.selectedIds) {
    latest = await addWorkspaceProject(options.workspaceId, { projectId });
  }
  if (latest) options.setWorkspace(latest);
  return latest;
}

export async function removeProjectMember(options: {
  workspaceId: string;
  projectId: string;
  setWorkspace: (w: WorkspaceDetail) => void;
}): Promise<void> {
  options.setWorkspace(
    await removeWorkspaceProject(options.workspaceId, options.projectId)
  );
}

export async function saveMemberDepends(options: {
  workspaceId: string;
  member: WorkspaceMember;
  dependsOn: string[];
  setWorkspace: (w: WorkspaceDetail) => void;
}): Promise<void> {
  options.setWorkspace(
    await updateWorkspaceProject({
      workspaceId: options.workspaceId,
      projectId: options.member.projectId,
      patch: { dependsOn: options.dependsOn }
    })
  );
}
