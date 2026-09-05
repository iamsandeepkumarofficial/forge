import type { WorkspaceProject, WorkspaceRoute } from "@forge/db";
import { WorkspaceRepository } from "../../catalog/workspaceRepository.js";
import { findDependsOnCycle, normalizeRepoName } from "./workspaceWiring.js";

const N_400 = 400;
const N_409 = 409;

function httpError(
  status: number,
  message: string
): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

export function validateDependsOn(options: {
  dependsOn: string[];
  memberNames: Set<string>;
  selfName?: string;
}): string[] {
  const { dependsOn, memberNames, selfName } = options;
  if (!Array.isArray(dependsOn)) {
    throw httpError(N_400, "dependsOn must be an array of repoNames");
  }
  const out: string[] = [];
  for (const raw of dependsOn) {
    const name = typeof raw === "string" ? raw.trim() : "";
    if (!name) continue;
    if (selfName && name === selfName) {
      throw httpError(N_400, "A member cannot dependOn itself");
    }
    if (!memberNames.has(name)) {
      throw httpError(
        N_400,
        `dependsOn "${name}" is not a member of this workspace`
      );
    }
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

export async function resolveNextRepoName(options: {
  workspaceRepo: WorkspaceRepository;
  workspaceId: string;
  member: WorkspaceProject;
  patchRepoName?: string;
}): Promise<string> {
  const { workspaceRepo, workspaceId, member, patchRepoName } = options;
  const nextRepoName =
    patchRepoName != null ? normalizeRepoName(patchRepoName) : member.repoName;
  if (nextRepoName !== member.repoName) {
    const clash = await workspaceRepo.findMemberByRepoName(
      workspaceId,
      nextRepoName
    );
    if (clash) {
      throw httpError(
        N_409,
        `repoName "${nextRepoName}" is already used in this workspace`
      );
    }
  }
  return nextRepoName;
}

export function buildProposedDependsGraph(options: {
  members: WorkspaceProject[];
  projectId: string;
  member: WorkspaceProject;
  nextRepoName: string;
  nextDependsOn: string[];
}): Array<{ repoName: string; dependsOn: string[] }> {
  const { members, projectId, member, nextRepoName, nextDependsOn } = options;
  return members.map((m) =>
    m.projectId === projectId
      ? {
          repoName: nextRepoName,
          dependsOn: nextDependsOn
        }
      : {
          repoName: m.repoName,
          dependsOn: m.dependsOn.map((d) =>
            d === member.repoName ? nextRepoName : d
          )
        }
  );
}

export async function rewriteDependsOnForRename(options: {
  workspaceRepo: WorkspaceRepository;
  workspaceId: string;
  members: WorkspaceProject[];
  projectId: string;
  oldRepoName: string;
  nextRepoName: string;
}): Promise<void> {
  const {
    workspaceRepo,
    workspaceId,
    members,
    projectId,
    oldRepoName,
    nextRepoName
  } = options;
  if (nextRepoName === oldRepoName) return;
  for (const m of members) {
    if (m.projectId === projectId) continue;
    if (!m.dependsOn.includes(oldRepoName)) continue;
    await workspaceRepo.updateMember({
      workspaceId,
      projectId: m.projectId,
      patch: {
        dependsOn: m.dependsOn.map((d) =>
          d === oldRepoName ? nextRepoName : d
        )
      }
    });
  }
}

export async function rewriteRoutesForRename(options: {
  workspaceRepo: WorkspaceRepository;
  workspaceId: string;
  oldRepoName: string;
  nextRepoName: string;
}): Promise<void> {
  const { workspaceRepo, workspaceId, oldRepoName, nextRepoName } = options;
  if (nextRepoName === oldRepoName) return;
  const ws = await workspaceRepo.getById(workspaceId);
  if (!ws?.routes?.length) return;
  const routes: WorkspaceRoute[] = ws.routes.map((r) =>
    r.target === oldRepoName ? { ...r, target: nextRepoName } : r
  );
  await workspaceRepo.updateRoutes(workspaceId, routes);
}

export function assertNoDependsCycle(
  proposed: Array<{ repoName: string; dependsOn: string[] }>
): void {
  const cycle = findDependsOnCycle(proposed);
  if (cycle) {
    throw httpError(N_400, `dependsOn cycle: ${cycle.join(" -> ")}`);
  }
}
