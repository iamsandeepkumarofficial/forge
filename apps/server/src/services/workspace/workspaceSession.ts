import { ChatFeatureRepository } from "../../catalog/chatFeatureRepository.js";
import { WorkspaceRepository } from "../../catalog/workspaceRepository.js";
import type { Workspace, WorkspaceProject, WorkspaceRoute } from "@forge/db";

export type WorkspaceSessionContext = {
  workspaceId: string;
  workspace: Workspace;
  members: WorkspaceProject[];
  routes: WorkspaceRoute[];
};

/** Load workspace membership + routes for a session, or null if project-scoped. */
export async function loadWorkspaceSessionContext(
  sessionId: string
): Promise<WorkspaceSessionContext | null> {
  const chatRepo = new ChatFeatureRepository();
  const workspaceRepo = new WorkspaceRepository();
  const chat = await chatRepo.getBySessionId(sessionId);
  if (!chat?.workspaceId) return null;
  const workspace = await workspaceRepo.getById(chat.workspaceId);
  if (!workspace) return null;
  const members = await workspaceRepo.listMembers(chat.workspaceId);
  return {
    workspaceId: chat.workspaceId,
    workspace,
    members,
    routes: workspace.routes ?? []
  };
}
