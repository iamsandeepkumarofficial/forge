import type {
  Project,
  Workspace,
  WorkspaceProject,
  WorkspaceRoute
} from "@forge/db";
import { ProjectRepository } from "../../catalog/projectRepository.js";
import { WorkspaceRepository } from "../../catalog/workspaceRepository.js";
import {
  findDependsOnCycle,
  normalizeRepoName,
  validateWorkspaceRoutes
} from "./workspaceWiring.js";
import { scheduleWorkspaceHealthAnalysis } from "./workspaceHealthJob.js";

const N_403 = 403;
const N_404 = 404;
const N_409 = 409;

export type WorkspaceMemberView = WorkspaceProject & {
  project: Project;
};

export type WorkspaceDetail = Workspace & {
  members: WorkspaceMemberView[];
};

function httpError(status: number, message: string): Error & { status: number } {
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

export class WorkspaceService {
  private workspaceRepo: WorkspaceRepository;
  private projectRepo: ProjectRepository;

  constructor(
    workspaceRepo = new WorkspaceRepository(),
    projectRepo = new ProjectRepository()
  ) {
    this.workspaceRepo = workspaceRepo;
    this.projectRepo = projectRepo;
  }

  async createWorkspace(
    userId: string,
    name: string
  ): Promise<WorkspaceDetail> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw httpError(400, "name is required");
    }
    const ws = await this.workspaceRepo.create({
      userId,
      name: trimmed,
      routes: []
    });
    scheduleWorkspaceHealthAnalysis(ws.id);
    return { ...ws, members: [] };
  }

  async listWorkspaces(userId: string): Promise<Workspace[]> {
    return this.workspaceRepo.listByUserId(userId);
  }

  async getWorkspaceDetail(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceDetail> {
    const ws = await this.requireOwnedWorkspace(workspaceId, userId);
    const members = await this.loadMemberViews(workspaceId);
    return { ...ws, members };
  }

  async deleteWorkspace(workspaceId: string, userId: string): Promise<void> {
    await this.requireOwnedWorkspace(workspaceId, userId);
    await this.workspaceRepo.delete(workspaceId);
  }

  async renameWorkspace(
    workspaceId: string,
    userId: string,
    name: string
  ): Promise<WorkspaceDetail> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw httpError(400, "name is required");
    }
    await this.requireOwnedWorkspace(workspaceId, userId);
    await this.workspaceRepo.updateName(workspaceId, trimmed);
    return this.getWorkspaceDetail(workspaceId, userId);
  }

  async setRoutes(
    workspaceId: string,
    userId: string,
    routes: WorkspaceRoute[]
  ): Promise<WorkspaceDetail> {
    await this.requireOwnedWorkspace(workspaceId, userId);
    const members = await this.workspaceRepo.listMembers(workspaceId);
    const names = new Set(members.map((m) => m.repoName));
    const normalized = validateWorkspaceRoutes(routes, names);
    await this.workspaceRepo.updateRoutes(workspaceId, normalized);
    scheduleWorkspaceHealthAnalysis(workspaceId);
    return this.getWorkspaceDetail(workspaceId, userId);
  }

  async addProject(
    workspaceId: string,
    userId: string,
    input: {
      projectId: string;
      repoName?: string;
      dependsOn?: string[];
      env?: Record<string, string>;
      sortOrder?: number;
    }
  ): Promise<WorkspaceDetail> {
    await this.requireOwnedWorkspace(workspaceId, userId);
    const project = await this.projectRepo.getById(input.projectId);
    if (!project) {
      throw httpError(N_404, "Project not found");
    }
    if (project.userId !== userId) {
      throw httpError(N_403, "Forbidden");
    }
    const existing = await this.workspaceRepo.getMember(
      workspaceId,
      input.projectId
    );
    if (existing) {
      throw httpError(N_409, "Project is already a member of this workspace");
    }
    const repoName = input.repoName
      ? normalizeRepoName(input.repoName)
      : defaultRepoNameFromProject(project);
    const clash = await this.workspaceRepo.findMemberByRepoName(
      workspaceId,
      repoName
    );
    if (clash) {
      throw httpError(
        N_409,
        `repoName "${repoName}" is already used in this workspace`
      );
    }
    const members = await this.workspaceRepo.listMembers(workspaceId);
    const dependsOn = this.validateDependsOn(
      input.dependsOn ?? [],
      new Set(members.map((m) => m.repoName))
    );
    const sortOrder =
      typeof input.sortOrder === "number"
        ? input.sortOrder
        : members.length === 0
          ? 0
          : Math.max(...members.map((m) => m.sortOrder)) + 1;
    await this.workspaceRepo.addMember({
      workspaceId,
      projectId: input.projectId,
      repoName,
      sortOrder,
      dependsOn,
      env: input.env ?? {}
    });
    await this.workspaceRepo.updateLastActivity(workspaceId);
    scheduleWorkspaceHealthAnalysis(workspaceId);
    return this.getWorkspaceDetail(workspaceId, userId);
  }

  async removeProject(
    workspaceId: string,
    userId: string,
    projectId: string
  ): Promise<WorkspaceDetail> {
    await this.requireOwnedWorkspace(workspaceId, userId);
    const member = await this.workspaceRepo.getMember(workspaceId, projectId);
    if (!member) {
      throw httpError(N_404, "Project is not a member of this workspace");
    }
    await this.workspaceRepo.removeMember(workspaceId, projectId);
    
    const remaining = await this.workspaceRepo.listMembers(workspaceId);
    for (const m of remaining) {
      if (m.dependsOn.includes(member.repoName)) {
        await this.workspaceRepo.updateMember(workspaceId, m.projectId, {
          dependsOn: m.dependsOn.filter((d) => d !== member.repoName)
        });
      }
    }
    const ws = await this.workspaceRepo.getById(workspaceId);
    if (ws) {
      const names = new Set(
        remaining.map((m) => m.repoName).filter((n) => n !== member.repoName)
      );
      const cleaned = (ws.routes ?? []).filter((r) => names.has(r.target));
      if (cleaned.length !== (ws.routes ?? []).length) {
        await this.workspaceRepo.updateRoutes(workspaceId, cleaned);
      }
    }
    await this.workspaceRepo.updateLastActivity(workspaceId);
    scheduleWorkspaceHealthAnalysis(workspaceId);
    return this.getWorkspaceDetail(workspaceId, userId);
  }

  async updateMember(
    workspaceId: string,
    userId: string,
    projectId: string,
    patch: {
      repoName?: string;
      dependsOn?: string[];
      env?: Record<string, string>;
      sortOrder?: number;
    }
  ): Promise<WorkspaceDetail> {
    await this.requireOwnedWorkspace(workspaceId, userId);
    const member = await this.workspaceRepo.getMember(workspaceId, projectId);
    if (!member) {
      throw httpError(N_404, "Project is not a member of this workspace");
    }
    const members = await this.workspaceRepo.listMembers(workspaceId);
    const nextRepoName =
      patch.repoName != null
        ? normalizeRepoName(patch.repoName)
        : member.repoName;
    if (nextRepoName !== member.repoName) {
      const clash = await this.workspaceRepo.findMemberByRepoName(
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
    const memberNames = new Set(
      members.map((m) =>
        m.projectId === projectId ? nextRepoName : m.repoName
      )
    );
    const nextDependsOn =
      patch.dependsOn != null
        ? this.validateDependsOn(patch.dependsOn, memberNames, nextRepoName)
        : member.dependsOn.map((d) =>
            d === member.repoName ? nextRepoName : d
          );
    const proposed = members.map((m) =>
      m.projectId === projectId
        ? {
            repoName: nextRepoName,
            dependsOn: nextDependsOn
          }
        : {
            repoName:
              m.repoName === member.repoName && nextRepoName !== member.repoName
                ? m.repoName
                : m.repoName,
            dependsOn: m.dependsOn.map((d) =>
              d === member.repoName ? nextRepoName : d
            )
          }
    );
    
    if (nextRepoName !== member.repoName) {
      for (const m of members) {
        if (m.projectId === projectId) continue;
        if (!m.dependsOn.includes(member.repoName)) continue;
        await this.workspaceRepo.updateMember(workspaceId, m.projectId, {
          dependsOn: m.dependsOn.map((d) =>
            d === member.repoName ? nextRepoName : d
          )
        });
      }
    }
    const cycle = findDependsOnCycle(proposed);
    if (cycle) {
      throw httpError(400, `dependsOn cycle: ${cycle.join(" -> ")}`);
    }
    await this.workspaceRepo.updateMember(workspaceId, projectId, {
      repoName: nextRepoName,
      dependsOn: nextDependsOn,
      ...(patch.env != null ? { env: patch.env } : {}),
      ...(typeof patch.sortOrder === "number"
        ? { sortOrder: patch.sortOrder }
        : {})
    });
    if (nextRepoName !== member.repoName) {
      const ws = await this.workspaceRepo.getById(workspaceId);
      if (ws?.routes?.length) {
        const routes = ws.routes.map((r) =>
          r.target === member.repoName
            ? { ...r, target: nextRepoName }
            : r
        );
        await this.workspaceRepo.updateRoutes(workspaceId, routes);
      }
    }
    await this.workspaceRepo.updateLastActivity(workspaceId);
    scheduleWorkspaceHealthAnalysis(workspaceId);
    return this.getWorkspaceDetail(workspaceId, userId);
  }

  private validateDependsOn(
    dependsOn: string[],
    memberNames: Set<string>,
    selfName?: string
  ): string[] {
    if (!Array.isArray(dependsOn)) {
      throw httpError(400, "dependsOn must be an array of repoNames");
    }
    const out: string[] = [];
    for (const raw of dependsOn) {
      const name = typeof raw === "string" ? raw.trim() : "";
      if (!name) continue;
      if (selfName && name === selfName) {
        throw httpError(400, "A member cannot dependOn itself");
      }
      if (!memberNames.has(name)) {
        throw httpError(
          400,
          `dependsOn "${name}" is not a member of this workspace`
        );
      }
      if (!out.includes(name)) out.push(name);
    }
    return out;
  }

  private async requireOwnedWorkspace(
    workspaceId: string,
    userId: string
  ): Promise<Workspace> {
    const ws = await this.workspaceRepo.getById(workspaceId);
    if (!ws) {
      throw httpError(N_404, "Workspace not found");
    }
    if (ws.userId !== userId) {
      throw httpError(N_403, "Forbidden");
    }
    return ws;
  }

  private async loadMemberViews(
    workspaceId: string
  ): Promise<WorkspaceMemberView[]> {
    const members = await this.workspaceRepo.listMembers(workspaceId);
    const views: WorkspaceMemberView[] = [];
    for (const m of members) {
      const project = await this.projectRepo.getById(m.projectId);
      if (!project) continue;
      views.push({ ...m, project });
    }
    return views;
  }
}
