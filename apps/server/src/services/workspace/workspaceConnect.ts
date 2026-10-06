import type { Project } from "@forge/db";
import type { ProjectRepository } from "../../catalog/projectRepository.js";
import type { WorkspaceRepository } from "../../catalog/workspaceRepository.js";
import { normalizeRepoName } from "./workspaceWiring.js";

const N_403 = 403;
const N_404 = 404;

function httpError(
  status: number,
  message: string
): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

function defaultRepoNameFromProject(project: Project): string {
  if (project.source === "github") {
    const repo = project.dedupeKey.split("/").pop() || project.name;
    return normalizeRepoName(repo.replace(/[^a-zA-Z0-9._-]/g, "-") || "repo");
  }
  const base = project.name.replace(/[^a-zA-Z0-9._-]/g, "-") || "repo";
  return normalizeRepoName(base);
}

export type WorkspaceConnectHost = {
  projectRepo: ProjectRepository;
  workspaceRepo: WorkspaceRepository;
  createWorkspace: (userId: string, name: string) => Promise<{ id: string }>;
  addProject: (options: {
    workspaceId: string;
    userId: string;
    input: { projectId: string };
  }) => Promise<unknown>;
};

export async function wrapProjectInNewWorkspace(
  host: WorkspaceConnectHost,
  options: {
    userId: string;
    projectId: string;
    workspaceName: string;
  }
): Promise<{ workspaceId: string }> {
  const project = await host.projectRepo.getById(options.projectId);
  if (!project) {
    throw httpError(N_404, "Project not found");
  }
  if (project.userId !== options.userId) {
    throw httpError(N_403, "Forbidden");
  }
  const name =
    options.workspaceName.trim() ||
    project.name.trim() ||
    defaultRepoNameFromProject(project);
  const ws = await host.createWorkspace(options.userId, name);
  await host.addProject({
    workspaceId: ws.id,
    userId: options.userId,
    input: { projectId: options.projectId }
  });
  return { workspaceId: ws.id };
}

export async function findPrimaryWorkspaceIdForProject(
  host: WorkspaceConnectHost,
  projectId: string
): Promise<string | null> {
  const memberships =
    await host.workspaceRepo.listMembershipsByProjectId(projectId);
  return memberships[0]?.workspaceId ?? null;
}

export async function ensureWorkspaceForProject(
  host: WorkspaceConnectHost,
  options: {
    userId: string;
    projectId: string;
    workspaceName?: string;
  }
): Promise<{ workspaceId: string }> {
  const existing = await findPrimaryWorkspaceIdForProject(
    host,
    options.projectId
  );
  if (existing) {
    return { workspaceId: existing };
  }
  const project = await host.projectRepo.getById(options.projectId);
  if (!project) {
    throw httpError(N_404, "Project not found");
  }
  return wrapProjectInNewWorkspace(host, {
    userId: options.userId,
    projectId: options.projectId,
    workspaceName: options.workspaceName ?? project.name
  });
}

export async function backfillOrphanProjects(
  host: WorkspaceConnectHost,
  userId: string
): Promise<number> {
  const projects = await host.projectRepo.listByUserId(userId);
  let created = 0;
  for (const project of projects) {
    const existing = await findPrimaryWorkspaceIdForProject(host, project.id);
    if (existing) continue;
    await wrapProjectInNewWorkspace(host, {
      userId,
      projectId: project.id,
      workspaceName: project.name
    });
    created += 1;
  }
  return created;
}
