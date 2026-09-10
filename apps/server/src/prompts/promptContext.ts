import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import { WorkspaceRepository } from "../catalog/workspaceRepository.js";
import {
  formatRepoInventoryBlock,
  loadRepoInventoryFromHost
} from "../projects/repoInventory.js";
import { resolveSessionEnv } from "../services/parameters/resolveSessionEnv.js";
import type { ChatAgentPromptPaths } from "./chatAgent.prompts.js";

export async function buildPromptContextForSession(options: {
  sessionId: string;
  paths: Omit<ChatAgentPromptPaths, "inventoryBlock" | "envKeyNames">;
}): Promise<ChatAgentPromptPaths> {
  const { sessionId, paths } = options;
  const sessionEnv = await resolveSessionEnv(sessionId);
  const worktrees = paths.worktrees;
  const memberNames = worktrees ? Object.keys(worktrees).sort() : [];

  const chatRepo = new ChatFeatureRepository();
  const chat = await chatRepo.getBySessionId(sessionId);
  const executionTarget = chat?.executionTarget ?? "local";

  if (memberNames.length === 0) {
    const root = paths.hostWorkingDir ?? paths.workingDir;
    const inventory = loadRepoInventoryFromHost({
      members: [{ repo: paths.repoDir, hostPath: root }],
      dependsOnGraph: []
    });
    return {
      ...paths,
      executionTarget,
      inventoryBlock: formatRepoInventoryBlock(inventory),
      envKeyNames: sessionEnv.envKeyNames
    };
  }

  const dependsOnGraph = await loadDependsOnGraph(sessionId);
  const hostTrees = paths.hostWorktrees ?? {};
  const inventory = loadRepoInventoryFromHost({
    members: memberNames.map((repo) => {
      const hostPath = hostTrees[repo];
      return {
        repo,
        hostPath: hostPath ?? paths.workingDir,
        ...(hostPath ? {} : { analyzable: false })
      };
    }),
    dependsOnGraph
  });

  return {
    ...paths,
    executionTarget,
    inventoryBlock: formatRepoInventoryBlock(inventory),
    envKeyNames: sessionEnv.envKeyNames
  };
}

async function loadDependsOnGraph(
  sessionId: string
): Promise<Array<{ repo: string; dependsOn: string[] }>> {
  const workspaceRepo = new WorkspaceRepository();
  const chatRepo = new ChatFeatureRepository();
  const chat = await chatRepo.getBySessionId(sessionId);
  if (!chat?.workspaceId) return [];
  const members = await workspaceRepo.listMembers(chat.workspaceId);
  return members.map((m) => ({
    repo: m.repoName,
    dependsOn: m.dependsOn ?? []
  }));
}
