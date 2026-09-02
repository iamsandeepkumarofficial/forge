import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import { WorkspaceEnvironmentRepository } from "../catalog/workspaceEnvironmentRepository.js";
import { WorkspaceRepository } from "../catalog/workspaceRepository.js";
import {
  readForgeConfig,
  writeForgeConfig,
  type AppType,
  type ForgeApp,
  type ForgeConfig
} from "./appRunner.js";
import {
  captureCachedDeps,
  clearWorkspaceDepsCache,
  restoreCachedDeps,
  workspaceDepsVolumeName
} from "./workspaceDepsCache.js";
import { resolveSandbox } from "./sandboxExec.js";
import {
  formatLaunchAppNames,
  logLaunchConfigPromoted,
  logLaunchConfigSeedSkip,
  logLaunchConfigSeeded
} from "./launchConfigLog.js";

function asForgeConfig(launch: { apps: unknown[] }): ForgeConfig {
  const apps: ForgeApp[] = [];
  for (const item of launch.apps) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const raw = item as Record<string, unknown>;
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    const cwd = typeof raw.cwd === "string" ? raw.cwd.trim() : "";
    const command = typeof raw.command === "string" ? raw.command.trim() : "";
    if (!name || !cwd || !command) continue;
    const type: AppType =
      raw.type === "api" || raw.type === "worker" || raw.type === "web"
        ? raw.type
        : "web";
    const port =
      typeof raw.port === "number" && Number.isFinite(raw.port)
        ? raw.port
        : undefined;
    const repo =
      typeof raw.repo === "string" && raw.repo.trim()
        ? raw.repo.trim()
        : undefined;
    apps.push({
      name,
      cwd,
      command,
      type,
      ...(port != null ? { port } : {}),
      ...(repo ? { repo } : {})
    });
  }
  return { apps };
}

/** Seed session launch.json from workspace catalog when session file is empty. */
export async function seedLaunchFromWorkspace(
  sessionId: string
): Promise<boolean> {
  const chatRepo = new ChatFeatureRepository();
  const chat = await chatRepo.getBySessionId(sessionId);
  if (!chat?.workspaceId) {
    logLaunchConfigSeedSkip({
      sessionId,
      reason: "not-workspace-chat"
    });
    return false;
  }

  const envRepo = new WorkspaceEnvironmentRepository();
  const saved = await envRepo.get(chat.workspaceId);
  if (!saved) {
    logLaunchConfigSeedSkip({
      sessionId,
      workspaceId: chat.workspaceId,
      reason: "catalog-missing"
    });
    return false;
  }
  if (saved.launch.apps.length === 0) {
    logLaunchConfigSeedSkip({
      sessionId,
      workspaceId: chat.workspaceId,
      reason: "catalog-empty"
    });
    return false;
  }

  const config = asForgeConfig(saved.launch);
  if (config.apps.length === 0) {
    logLaunchConfigSeedSkip({
      sessionId,
      workspaceId: chat.workspaceId,
      reason: "catalog-invalid"
    });
    return false;
  }

  await writeForgeConfig(sessionId, config);
  logLaunchConfigSeeded({
    sessionId,
    workspaceId: chat.workspaceId,
    appCount: config.apps.length,
    appNames: formatLaunchAppNames(config.apps),
    sourceSessionId: saved.sourceSessionId,
    catalogUpdatedAt: saved.updatedAt?.toISOString() ?? null
  });
  return true;
}

/** Persist session launch.json to workspace catalog after a successful app start. */
export async function promoteLaunchToWorkspace(
  sessionId: string
): Promise<void> {
  const chatRepo = new ChatFeatureRepository();
  const chat = await chatRepo.getBySessionId(sessionId);
  if (!chat?.workspaceId) return;

  const { exists, config } = await readForgeConfig(sessionId);
  if (!exists || config.apps.length === 0) return;

  const envRepo = new WorkspaceEnvironmentRepository();
  await envRepo.upsertLaunch(chat.workspaceId, config, sessionId);
  logLaunchConfigPromoted({
    sessionId,
    workspaceId: chat.workspaceId,
    appCount: config.apps.length,
    appNames: formatLaunchAppNames(config.apps)
  });
}

async function memberRepoNames(sessionId: string): Promise<string[]> {
  const chatRepo = new ChatFeatureRepository();
  const chat = await chatRepo.getBySessionId(sessionId);
  if (!chat?.workspaceId) return [""];
  const workspaceRepo = new WorkspaceRepository();
  const members = await workspaceRepo.listMembers(chat.workspaceId);
  if (members.length === 0) return [""];
  return members.map((m) => m.repoName);
}

/** Restore node_modules from the workspace deps volume into each member. */
export async function restoreWorkspaceDepsForSession(
  sessionId: string
): Promise<void> {
  const { containerName } = await resolveSandbox(sessionId);
  const repos = await memberRepoNames(sessionId);
  for (const repoName of repos) {
    const ok = await restoreCachedDeps({ containerName, repoName }).catch(
      () => false
    );
    console.info(
      `[workspaceEnvironment] deps restore session=${sessionId} repo=${repoName || "(root)"} ok=${ok}`
    );
  }
}

/** Capture node_modules onto the workspace deps volume after a successful start. */
export async function captureWorkspaceDepsForSession(
  sessionId: string
): Promise<void> {
  const { containerName } = await resolveSandbox(sessionId);
  const repos = await memberRepoNames(sessionId);
  for (const repoName of repos) {
    const ok = await captureCachedDeps({ containerName, repoName }).catch(
      () => false
    );
    console.info(
      `[workspaceEnvironment] deps capture session=${sessionId} repo=${repoName || "(root)"} ok=${ok}`
    );
  }
}

export async function getWorkspaceEnvironmentStatus(workspaceId: string) {
  const envRepo = new WorkspaceEnvironmentRepository();
  const saved = await envRepo.get(workspaceId);
  return {
    launch: saved?.launch ?? { apps: [] },
    updatedAt: saved?.updatedAt?.toISOString() ?? null,
    sourceSessionId: saved?.sourceSessionId ?? null,
    depsVolumeName: workspaceDepsVolumeName(workspaceId)
  };
}

export async function clearWorkspaceLaunch(
  workspaceId: string
): Promise<void> {
  const envRepo = new WorkspaceEnvironmentRepository();
  await envRepo.clearLaunch(workspaceId);
}

export async function clearWorkspacePackageCache(
  workspaceId: string
): Promise<void> {
  await clearWorkspaceDepsCache(workspaceId);
}
