import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import { WorkspaceRepository } from "../catalog/workspaceRepository.js";
import { WorkspaceHealthRepository } from "../catalog/workspaceHealthRepository.js";
import {
  formatRepoInventoryBlock,
  loadRepoInventoryFromHost
} from "../projects/repoInventory.js";
import { readForgeConfig } from "../projects/appRunner.js";
import {
  formatHealthPromptBlock,
  formatSetupAgentSopBlock
} from "../services/workspace/health/types.js";
import type { WorkspaceHealthReport } from "../services/workspace/health/types.js";
import { resolveSessionEnv } from "../services/parameters/resolveSessionEnv.js";
import { readinessFromForgeApps } from "./repoReadiness.js";
import type { ChatAgentPromptPaths } from "./chatAgent.prompts.js";

export async function buildPromptContextForSession(options: {
  sessionId: string;
  paths: Omit<
    ChatAgentPromptPaths,
    | "inventoryBlock"
    | "healthBlock"
    | "envKeyNames"
    | "readiness"
    | "setupSopBlock"
  >;
}): Promise<ChatAgentPromptPaths> {
  const { sessionId, paths } = options;
  const sessionEnv = await resolveSessionEnv(sessionId);
  const worktrees = paths.worktrees;
  const memberNames = worktrees ? Object.keys(worktrees).sort() : [];

  if (memberNames.length === 0) {
    const root = paths.hostWorkingDir ?? paths.workingDir;
    const inventory = loadRepoInventoryFromHost({
      members: [{ repo: paths.repoDir, hostPath: root }],
      dependsOnGraph: []
    });
    return {
      ...paths,
      inventoryBlock: formatRepoInventoryBlock(inventory),
      healthBlock: "",
      envKeyNames: sessionEnv.envKeyNames
    };
  }

  const readiness = await loadWorkspaceReadiness(sessionId, memberNames);
  const workspaceCtx = await loadWorkspaceHealthContext(sessionId);
  const hostTrees = paths.hostWorktrees ?? {};
  const inventory = loadRepoInventoryFromHost({
    members: memberNames.map((repo) => ({
      repo,
      hostPath: hostTrees[repo] ?? paths.workingDir,
      analyzable: Boolean(hostTrees[repo])
    })),
    dependsOnGraph: workspaceCtx.dependsOnGraph
  });

  return {
    ...paths,
    inventoryBlock: formatRepoInventoryBlock(inventory),
    healthBlock: workspaceCtx.healthBlock,
    ...(workspaceCtx.setupSopBlock
      ? { setupSopBlock: workspaceCtx.setupSopBlock }
      : {}),
    envKeyNames: sessionEnv.envKeyNames,
    ...(readiness ? { readiness } : {})
  };
}

async function loadWorkspaceReadiness(
  sessionId: string,
  memberNames: string[]
): Promise<ChatAgentPromptPaths["readiness"]> {
  try {
    const { exists, source, config } = await readForgeConfig(sessionId);
    return readinessFromForgeApps({
      apps: config.apps,
      source: exists ? source : "none",
      memberRepos: memberNames
    });
  } catch {
    return readinessFromForgeApps({
      apps: [],
      source: "none",
      memberRepos: memberNames
    });
  }
}

async function loadWorkspaceHealthContext(sessionId: string): Promise<{
  dependsOnGraph: Array<{ repo: string; dependsOn: string[] }>;
  healthBlock: string;
  setupSopBlock: string;
}> {
  const workspaceRepo = new WorkspaceRepository();
  const chatRepo = new ChatFeatureRepository();
  const chat = await chatRepo.getBySessionId(sessionId);
  if (!chat?.workspaceId) {
    return {
      dependsOnGraph: [],
      healthBlock: "",
      setupSopBlock: formatSetupAgentSopBlock()
    };
  }
  const members = await workspaceRepo.listMembers(chat.workspaceId);
  const dependsOnGraph = members.map((m) => ({
    repo: m.repoName,
    dependsOn: m.dependsOn ?? []
  }));
  const healthRepo = new WorkspaceHealthRepository();
  const healthRow = await healthRepo.get(chat.workspaceId);
  if (healthRow?.report && typeof healthRow.report === "object") {
    const report = healthRow.report as WorkspaceHealthReport;
    return {
      dependsOnGraph,
      healthBlock: formatHealthPromptBlock(report),
      setupSopBlock: formatSetupAgentSopBlock({
        preferredSandboxImage:
          report.shadows?.preferredSandboxImage ??
          report.prepare?.shadows?.preferredSandboxImage
      })
    };
  }
  return {
    dependsOnGraph,
    healthBlock: "",
    setupSopBlock: formatSetupAgentSopBlock()
  };
}
