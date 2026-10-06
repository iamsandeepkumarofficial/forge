import * as path from "node:path";
import fs from "node:fs/promises";
import { ProjectRepository } from "../../catalog/projectRepository.js";
import { cloneGithubRepo } from "../codebase/codebase.service.js";
import { GithubService } from "../github/github.service.js";
import { assertLocalFolderPath } from "../../projects/sessionSandbox/materialize.js";
import { ensureCanonicalGitRepo } from "../../projects/localWorktree.js";
import { copyProjectTree } from "./copyProjectTree.js";
import { ensureProjectsRoot, projectCanonicalDir } from "./projectsRoot.js";
import { WorkspaceService } from "../workspace/workspace.service.js";

const N_403 = 403;
const N_404 = 404;
const N_500 = 500;

export type ConnectProjectResult = {
  projectId: string;
  workspaceId: string;
  alreadyConnected?: boolean;
};

export class ProjectService {
  private projectRepo: ProjectRepository;
  private github: GithubService;
  constructor(
    projectRepo = new ProjectRepository(),
    github = new GithubService()
  ) {
    this.projectRepo = projectRepo;
    this.github = github;
  }
  private workspaceService(): WorkspaceService {
    return new WorkspaceService();
  }
  async connectGithub(
    githubSlug: string,
    userId: string
  ): Promise<ConnectProjectResult> {
    if (!githubSlug || typeof githubSlug !== "string") {
      throw new Error("Invalid GitHub slug: must be a non-empty string");
    }
    const sanitizedSlug = this.github.validateSlugFormat(githubSlug);
    const existingProject = await this.projectRepo.findByDedupeKey(
      userId,
      sanitizedSlug
    );
    if (existingProject) {
      throw new Error(
        `Project already connected: "${sanitizedSlug}" is linked to an existing project. Use the project dashboard to manage connections.`
      );
    }
    const token = await this.github.getAccessToken(userId);
    await cloneGithubRepo(sanitizedSlug, { token: token ?? undefined });
    const result = await this.projectRepo.createProject({
      userId,
      source: "github",
      dedupeKey: sanitizedSlug,
      name: sanitizedSlug,
      canonicalKey: null,
      status: "available"
    });
    const { workspaceId } =
      await this.workspaceService().wrapProjectInNewWorkspace({
        userId,
        projectId: result.id,
        workspaceName: sanitizedSlug
      });
    return {
      projectId: result.id,
      workspaceId,
      alreadyConnected: false
    };
  }

  async connectLocalFolder(options: {
    localPath: string;
    userId: string;
    name?: string;
  }): Promise<ConnectProjectResult> {
    const { localPath, userId, name } = options;
    const abs = await assertLocalFolderPath(localPath);
    const dedupeKey = `local:${abs}`;
    const existing = await this.projectRepo.findByDedupeKey(userId, dedupeKey);
    if (existing) {
      const { workspaceId } =
        await this.workspaceService().ensureWorkspaceForProject({
          userId,
          projectId: existing.id,
          workspaceName: existing.name
        });
      return { projectId: existing.id, workspaceId };
    }
    const displayName =
      (typeof name === "string" && name.trim()) ||
      path.basename(abs) ||
      "local";
    await ensureProjectsRoot();
    const result = await this.projectRepo.createProject({
      userId,
      source: "local",
      dedupeKey,
      name: displayName,
      canonicalKey: null,
      status: "available"
    });
    const dest = projectCanonicalDir(result.id);
    try {
      await copyProjectTree(abs, dest);
      await ensureCanonicalGitRepo(dest);
      await this.projectRepo.updateCanonicalKey(result.id, dest);
    } catch (err) {
      await fs.rm(dest, { recursive: true, force: true }).catch(() => {});
      await this.projectRepo.deleteProject(result.id);
      throw new Error(
        `Failed to copy project into ~/.forge/projects: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err }
      );
    }
    const { workspaceId } =
      await this.workspaceService().wrapProjectInNewWorkspace({
        userId,
        projectId: result.id,
        workspaceName: displayName
      });
    return { projectId: result.id, workspaceId };
  }

  async connectGitUrl(
    gitUrl: string,
    userId: string
  ): Promise<ConnectProjectResult> {
    if (!gitUrl || typeof gitUrl !== "string") {
      throw new Error("gitUrl is required");
    }
    let slug = gitUrl.trim();
    if (
      slug.startsWith("https://github.com/") ||
      slug.startsWith("http://github.com/")
    ) {
      const match = slug.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
      if (match) {
        slug = `${match[1]}/${match[2]}`;
      }
    }
    return this.connectGithub(slug, userId);
  }

  async listProjects(userId: string): Promise<
    Array<{
      id: string;
      name: string;
      source: string;
      status: string;
      createdAt: string;
    }>
  > {
    try {
      const projects = await this.projectRepo.listByUserId(userId);
      return projects.map((p) => ({
        id: p.id,
        name: p.name,
        source: p.source,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        lastActivityAt: p.lastActivityAt.toISOString()
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to list projects: ${message || "Unable to retrieve projects from database"}`
      );
    }
  }
  async getProjectById(id: string): Promise<{
    id: string;
    name: string;
    source: string;
    status: string;
    createdAt: string;
  } | null> {
    try {
      const result = await this.projectRepo.getById(id);
      if (!result) return null;
      return {
        id: result.id,
        name: result.name,
        source: result.source,
        status: result.status,
        createdAt: result.createdAt.toISOString()
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to retrieve project: ${message || "Unable to fetch project details"}`
      );
    }
  }
  async deleteProject(id: string, _userId: string): Promise<void> {
    const project = await this.projectRepo.getById(id);
    if (!project) {
      throw new Error("Project not found");
    }
    if (project.source === "local" && project.canonicalKey) {
      await fs
        .rm(project.canonicalKey, { recursive: true, force: true })
        .catch(() => {});
    }
    const { resolveSessionsRoot } = await import("./projectsRoot.js");
    await fs
      .rm(path.join(resolveSessionsRoot(), id), {
        recursive: true,
        force: true
      })
      .catch(() => {});
    await this.projectRepo.deleteProject(id);
  }
  async resolveAvailability(projectId: string): Promise<void> {
    try {
      const project = await this.getProjectById(projectId);
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }
      if (project.source === "github") {
        try {
          const { Octokit } = await import("@octokit/rest");
          const octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN
          });
          await octokit.repos.get({ owner: project.name, repo: project.name });
          await this.projectRepo.updateStatus(projectId, "available");
        } catch (err: unknown) {
          const message = "Could not verify GitHub repository reachability";
          const status =
            typeof err === "object" && err !== null && "status" in err
              ? Number(
                  (
                    err as {
                      status?: number;
                    }
                  ).status
                )
              : undefined;
          const errMessage = err instanceof Error ? err.message : String(err);
          if (status === N_404) {
            await this.projectRepo.updateStatus(projectId, "unavailable");
            console.warn(
              `GitHub availability check failed for ${projectId}: ${message} - Repository not found`
            );
          } else if (status === N_403) {
            await this.projectRepo.updateStatus(projectId, "unavailable");
            console.warn(
              `GitHub availability check failed for ${projectId}: ${message} - Rate limit or auth failed`
            );
          } else if (status !== undefined && status >= N_500) {
            await this.projectRepo.updateStatus(projectId, "available");
            console.warn(
              `GitHub availability check failed for ${projectId}: ${message} - Temporary server error`
            );
          } else {
            await this.projectRepo.updateStatus(projectId, "unavailable");
            console.warn(
              `GitHub availability check failed for ${projectId}: ${message} - ${errMessage}`
            );
          }
        }
      }
    } catch (error: unknown) {
      console.error(
        `Failed to resolve availability for project ${projectId}:`,
        error
      );
      throw new Error(
        `Failed to check project availability: ${error instanceof Error ? error.message : "Unable to verify project status"}`
      );
    }
  }
}
