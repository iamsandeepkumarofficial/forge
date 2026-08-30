import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import { WorkspaceRepository } from "../catalog/workspaceRepository.js";
import { WorkspaceHealthRepository } from "../catalog/workspaceHealthRepository.js";
import {
  formatRepoInventoryBlock,
  loadRepoInventoryFromHost
} from "../projects/repoInventory.js";
import { readForgeConfig } from "../projects/appRunner.js";
import { formatHealthPromptBlock, formatSetupAgentSopBlock } from "../services/workspace/health/types.js";
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
  let inventoryBlock = "";
  let healthBlock = "";
  let setupSopBlock = "";
  let dependsOnGraph: Array<{ repo: string; dependsOn: string[] }> = [];

  const worktrees = paths.worktrees;
  const memberNames = worktrees ? Object.keys(worktrees).sort() : [];

  let readiness: ChatAgentPromptPaths["readiness"];
  if (memberNames.length > 0) {
    try {
      const { exists, source, config } = await readForgeConfig(sessionId);
      readiness = readinessFromForgeApps({
        apps: config.apps,
        source: exists ? source : "none",
        memberRepos: memberNames
      });
    } catch {
      readiness = readinessFromForgeApps({
        apps: [],
        source: "none",
        memberRepos: memberNames
      });
    }

    const workspaceRepo = new WorkspaceRepository();
    const chatRepo = new ChatFeatureRepository();
    const chat = await chatRepo.getBySessionId(sessionId);
    if (chat?.workspaceId) {
      const members = await workspaceRepo.listMembers(chat.workspaceId);
      dependsOnGraph = members.map((m) => ({
        repo: m.repoName,
        dependsOn: m.dependsOn ?? []
      }));
      const healthRepo = new WorkspaceHealthRepository();
      const healthRow = await healthRepo.get(chat.workspaceId);
      if (healthRow?.report && typeof healthRow.report === "object") {
        const report = healthRow.report as WorkspaceHealthReport;
        healthBlock = formatHealthPromptBlock(report);
        setupSopBlock = formatSetupAgentSopBlock({
          preferredSandboxImage:
            report.shadows?.preferredSandboxImage ??
            report.prepare?.shadows?.preferredSandboxImage
        });
      } else {
        setupSopBlock = formatSetupAgentSopBlock();
      }
    } else {
      setupSopBlock = formatSetupAgentSopBlock();
    }
    const hostTrees = paths.hostWorktrees ?? {};
    const inventory = loadRepoInventoryFromHost({
      members: memberNames.map((repo) => ({
        repo,
        hostPath: hostTrees[repo] ?? paths.workingDir,
        analyzable: Boolean(hostTrees[repo])
      })),
      dependsOnGraph
    });
    inventoryBlock = formatRepoInventoryBlock(inventory);
  } else {
    const root = paths.hostWorkingDir ?? paths.workingDir;
    const inventory = loadRepoInventoryFromHost({
      members: [{ repo: paths.repoDir, hostPath: root }],
      dependsOnGraph: []
    });
    inventoryBlock = formatRepoInventoryBlock(inventory);
  }

  return {
    ...paths,
    inventoryBlock,
    healthBlock,
    ...(setupSopBlock ? { setupSopBlock } : {}),
    envKeyNames: sessionEnv.envKeyNames,
    ...(readiness ? { readiness } : {})
  };
}
