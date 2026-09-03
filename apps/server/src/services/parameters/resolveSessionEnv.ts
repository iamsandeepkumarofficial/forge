import { ChatFeatureRepository } from "../../catalog/chatFeatureRepository.js";
import { WorkspaceRepository } from "../../catalog/workspaceRepository.js";
import { ParameterRepository } from "../../catalog/parameterRepository.js";
import {
  sessionAppDbEnvFor,
  workspaceAppDbEnv
} from "../../projects/sessionAppDb.js";
import { WorkspaceDatabaseRepository } from "../../catalog/workspaceDatabaseRepository.js";
import { getAppDbEngine } from "../../projects/appDb/engines.js";

const PROTECTED_KEYS = new Set(["HOST", "PORT", "FORGE_PUBLISHED_APP_PORTS"]);

export type ResolvedSessionEnv = {
  containerEnv: Record<string, string>;
  byRepo: Record<string, Record<string, string>>;
  envKeyNames: string[];
};

function mergeParams(
  target: Record<string, string>,
  source: Record<string, string>
): void {
  for (const [k, v] of Object.entries(source)) {
    if (PROTECTED_KEYS.has(k)) continue;
    target[k] = v;
  }
}

/** Resolve layered env: Forge system → project → workspace → member templates (templates applied at app start). */
export async function resolveSessionEnv(
  sessionId: string
): Promise<ResolvedSessionEnv> {
  const chatRepo = new ChatFeatureRepository();
  const workspaceRepo = new WorkspaceRepository();
  const paramRepo = new ParameterRepository();

  const containerEnv: Record<string, string> = {};
  const byRepo: Record<string, Record<string, string>> = {};
  const keyNames = new Set<string>();

  const chat = await chatRepo.getBySessionId(sessionId);
  if (!chat) {
    Object.assign(containerEnv, sessionAppDbEnvFor(sessionId));
    for (const k of Object.keys(containerEnv)) keyNames.add(k);
    return { containerEnv, byRepo, envKeyNames: [...keyNames].sort() };
  }

  if (chat.workspaceId) {
    Object.assign(containerEnv, await workspaceAppDbEnv(chat.workspaceId));
    for (const k of Object.keys(containerEnv)) keyNames.add(k);
    const members = await workspaceRepo.listMembers(chat.workspaceId);
    const workspaceParams = await paramRepo.listWorkspaceParameters(
      chat.workspaceId
    );
    const wsMap = Object.fromEntries(
      workspaceParams.map((p) => [p.key, p.value])
    );
    mergeParams(containerEnv, wsMap);
    for (const p of workspaceParams) keyNames.add(p.key);

    for (const member of members) {
      const repoEnv: Record<string, string> = { ...containerEnv };
      const projectParams = await paramRepo.listProjectParameters(
        member.projectId
      );
      const projMap = Object.fromEntries(
        projectParams.map((p) => [p.key, p.value])
      );
      mergeParams(repoEnv, projMap);
      for (const p of projectParams) keyNames.add(p.key);
      byRepo[member.repoName] = repoEnv;
    }
    return { containerEnv, byRepo, envKeyNames: [...keyNames].sort() };
  }

  Object.assign(containerEnv, sessionAppDbEnvFor(sessionId));
  for (const k of Object.keys(containerEnv)) keyNames.add(k);

  if (chat.projectId) {
    const projectParams = await paramRepo.listProjectParameters(chat.projectId);
    const projMap = Object.fromEntries(
      projectParams.map((p) => [p.key, p.value])
    );
    mergeParams(containerEnv, projMap);
    for (const p of projectParams) keyNames.add(p.key);
  }

  return { containerEnv, byRepo, envKeyNames: [...keyNames].sort() };
}

/** Env keys Forge injects for a workspace based on attached engines. */
export async function forgeProvidedKeysForWorkspace(
  workspaceId: string
): Promise<Set<string>> {
  const keys = new Set(["HOST", "PORT", "FORGE_PUBLISHED_APP_PORTS"]);
  const repo = new WorkspaceDatabaseRepository();
  for (const row of await repo.list(workspaceId)) {
    const engine = getAppDbEngine(row.engineId);
    if (engine) keys.add(engine.envKey);
  }
  return keys;
}
