import * as unzipper from "unzipper";
import * as path from "node:path";
import { ProjectRepository } from "../../catalog/projectRepository.js";
import { cloneGithubRepo } from "../codebase/codebase.service.js";
import { GithubService } from "../github/github.service.js";
import { putObject, deleteObjectsWithPrefix } from "../storage/objectStore.js";
import { assertLocalFolderPath } from "../../projects/sessionSandbox/materialize.js";

const N_1024 = 1024;
const N_0x03 = 0x03;
const N_0x04 = 0x04;
const N_0x4b = 0x4b;
const N_0x50 = 0x50;
const N_403 = 403;
const N_404 = 404;
const N_500 = 500;

export class ProjectService {
  private projectRepo: ProjectRepository;
  private github: GithubService;
  constructor() {
    this.projectRepo = new ProjectRepository();
    this.github = new GithubService();
  }
  async connectGithub(
    githubSlug: string,
    userId: string
  ): Promise<{
    projectId: string;
    alreadyConnected: boolean;
  }> {
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
    return {
      projectId: result.id,
      alreadyConnected: false
    };
  }

  async connectLocalFolder(
    localPath: string,
    userId: string,
    name?: string
  ): Promise<{ projectId: string }> {
    const abs = await assertLocalFolderPath(localPath);
    const dedupeKey = `local:${abs}`;
    const existing = await this.projectRepo.findByDedupeKey(userId, dedupeKey);
    if (existing) {
      return { projectId: existing.id };
    }
    const displayName =
      (typeof name === "string" && name.trim()) || path.basename(abs) || "local";
    const result = await this.projectRepo.createProject({
      userId,
      source: "local",
      dedupeKey,
      name: displayName,
      canonicalKey: abs,
      status: "available"
    });
    return { projectId: result.id };
  }

  async connectGitUrl(
    gitUrl: string,
    userId: string
  ): Promise<{ projectId: string; alreadyConnected: boolean }> {
    if (!gitUrl || typeof gitUrl !== "string") {
      throw new Error("gitUrl is required");
    }
    let slug = gitUrl.trim();
    if (slug.startsWith("https://github.com/") || slug.startsWith("http://github.com/")) {
      const match = slug.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
      if (match) {
        slug = `${match[1]}/${match[2]}`;
      }
    }
    return this.connectGithub(slug, userId);
  }

  async uploadArchive(
    file: Express.Multer.File,
    userId: string
  ): Promise<{
    projectId: string;
  }> {
    if (!file) {
      throw new Error("No file provided for upload");
    }
    const maxSize =
      parseInt(process.env.PROJECT_UPLOAD_MAX_MB || "800", 10) *
      N_1024 *
      N_1024;
    if (file.size > maxSize) {
      throw new Error(
        `File too large: ${this.formatBytes(file.size)} exceeds the maximum allowed size of ${this.formatBytes(maxSize)}`
      );
    }
    if (!file.originalname.endsWith(".zip")) {
      throw new Error(
        "Invalid file type: only ZIP archives (.zip) are supported"
      );
    }
    const fileBuffer = Buffer.from(file.buffer);
    const zipMagic = fileBuffer.subarray(0, 4);
    const expectedMagic = Buffer.from([N_0x50, N_0x4b, N_0x03, N_0x04]);
    if (!zipMagic.equals(expectedMagic)) {
      throw new Error(
        "Invalid ZIP archive: file appears to be corrupted or not a valid ZIP file"
      );
    }
    const projectName = file.originalname.replace(/\.zip$/i, "");
    const result = await this.projectRepo.createProject({
      userId,
      source: "upload",
      dedupeKey: `upload-${Date.now()}`,
      name: projectName || "uploaded-project",
      canonicalKey: null,
      status: "available"
    });
    const bucket = process.env.OBJECT_STORE_BUCKET || "projects";
    const repoPrefix = `projects/${result.id}/repo`;
    try {
      const directory = await unzipper.Open.buffer(fileBuffer);
      const relPaths = directory.files
        .filter((e) => e.type !== "Directory")
        .map((e) => this.sanitizeArchiveEntryPath(e.path))
        .filter((p): p is string => p !== null);
      const strip = this.detectWrapperPrefix(relPaths);
      for (const entry of directory.files) {
        if (entry.type === "Directory") continue;
        const relativePath = this.sanitizeArchiveEntryPath(entry.path);
        if (!relativePath) continue;
        if (relativePath.split("/")[0] === "__MACOSX") continue;
        if (relativePath.split("/").pop() === ".DS_Store") continue;
        const repoRelative =
          strip && relativePath.startsWith(strip)
            ? relativePath.slice(strip.length)
            : relativePath;
        if (!repoRelative) continue;
        const entryBuffer = await entry.buffer();
        await putObject({
          bucket,
          key: `${repoPrefix}/${repoRelative}`,
          body: entryBuffer
        });
      }
      await this.projectRepo.updateCanonicalKey(result.id, repoPrefix);
    } catch (err: unknown) {
      await deleteObjectsWithPrefix(bucket, repoPrefix).catch(() => {});
      await this.projectRepo.deleteProject(result.id);
      throw new Error(
        `Failed to store archive: ${err instanceof Error ? err.message : "Unknown storage error"}`,
        { cause: err }
      );
    }
    return {
      projectId: result.id
    };
  }
  private detectWrapperPrefix(relPaths: string[]): string {
    const meaningful = relPaths.filter((p) => p.split("/")[0] !== "__MACOSX");
    const tops = new Set(meaningful.map((p) => p.split("/")[0]));
    if (tops.size !== 1) return "";
    const only = [...tops][0]!;
    if (!meaningful.some((p) => p.startsWith(`${only}/`))) return "";
    return `${only}/`;
  }
  private sanitizeArchiveEntryPath(entryPath: string): string | null {
    const normalized = entryPath.replace(/\\/g, "/");
    const segments = normalized.split("/").filter((seg) => seg.length > 0);
    if (
      segments.length === 0 ||
      segments.some((seg) => seg === "..") ||
      normalized.startsWith("/")
    ) {
      return null;
    }
    return segments.join("/");
  }
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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
        createdAt: p.createdAt.toISOString()
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
  async deleteProject(id: string, userId: string): Promise<void> {
    const project = await this.projectRepo.getById(id);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found");
    }
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
