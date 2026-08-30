import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import { ProjectRepository } from "../catalog/projectRepository.js";
import { WorkspaceRepository } from "../catalog/workspaceRepository.js";
import { GithubOAuthService } from "../integrations/githubOAuth.js";
import type { ChatFeature, Project, WorkspaceProject } from "@forge/db";
import {
  allocateReservedAppPort,
  DEFAULT_SANDBOX_IMAGE,
  FIRST_APP_PORT,
  hostPortForContainerPort,
  isReservedAppPort,
  LAST_APP_PORT,
  RESERVED_PORTS,
  sandboxContainerName,
  sessionHostPortBase,
  sessionVolumeName,
  WORKSPACE_MOUNT
} from "./sessionSandbox/constants.js";
import {
  assertLocalFolderPath,
  assertSafeBranch,
  cloneGithubIntoVolume,
  isRepoInitialized,
  isRepoInitializedAt,
  repoDirForProject,
  type LocalFolderSource
} from "./sessionSandbox/materialize.js";
import type { BindMount, NamedVolumeMount } from "./sandboxRuntime/types.js";
import {
  canonicalGitContainerPath,
  ensureSessionWorktree,
  removeSessionWorktree,
  worktreeWorkDir
} from "./localWorktree.js";

const execFileAsync = promisify(execFile);

export {
  allocateReservedAppPort,
  DEFAULT_SANDBOX_IMAGE,
  WORKSPACE_MOUNT,
  RESERVED_PORTS,
  FIRST_APP_PORT,
  LAST_APP_PORT,
  isReservedAppPort,
  sessionHostPortBase,
  hostPortForContainerPort,
  sessionVolumeName,
  sandboxContainerName
};

export interface SandboxStatus {
  status: "ready" | "empty" | "absent";
  workingDir: string;
  containerId?: string;
  running: boolean;
}

export type ProvisionSessionSource = LocalFolderSource;

function resolveLocalFolderPath(
  project: Project,
  source?: ProvisionSessionSource
): string | null {
  if (source?.type === "local_folder") {
    return source.path;
  }
  if (project.source === "local" && project.canonicalKey) {
    return project.canonicalKey;
  }
  return null;
}

async function sandboxSessionCreateOpts(
  sessionId: string,
  bindMounts?: BindMount[],
  workspaceId?: string
): Promise<{
  bindMounts?: BindMount[];
  namedVolumes?: NamedVolumeMount[];
  containerEnv: Record<string, string>;
  image?: string;
}> {
  const { resolveSessionEnv } = await import(
    "../services/parameters/resolveSessionEnv.js"
  );
  const env = await resolveSessionEnv(sessionId);
  let image: string | undefined;
  let namedVolumes: NamedVolumeMount[] | undefined;
  if (workspaceId) {
    const { selectSandboxImageForWorkspace } = await import(
      "./sandboxImageSelect.js"
    );
    image = await selectSandboxImageForWorkspace(workspaceId);
    const {
      ensureWorkspaceDepsVolume,
      DEPS_CACHE_MOUNT
    } = await import("./workspaceDepsCache.js");
    const volumeName = await ensureWorkspaceDepsVolume(workspaceId);
    namedVolumes = [{ volumeName, containerPath: DEPS_CACHE_MOUNT }];
  }
  return {
    bindMounts,
    namedVolumes,
    containerEnv: env.containerEnv,
    image
  };
}

export async function provisionSessionSandbox(
  sessionId: string,
  options?: { source?: ProvisionSessionSource }
): Promise<{
  status: "ready";
  workingDir: string;
  containerId: string;
}> {
  const chatRepo = new ChatFeatureRepository();
  const projectRepo = new ProjectRepository();
  const chat: ChatFeature | null = await chatRepo.getBySessionId(sessionId);
  if (!chat) {
    throw new Error(`No chat/feature found for session: ${sessionId}`);
  }

  const result = chat.workspaceId
    ? await provisionWorkspaceScopedSandbox({
        sessionId,
        workspaceId: chat.workspaceId,
        userId: chat.userId,
        branchName: chat.branchName
      })
    : await provisionProjectScopedAfterLookup({
        sessionId,
        chat,
        projectRepo,
        source: options?.source
      });
  try {
    const { touchSessionActivity } = await import("./sessionActivity.js");
    await touchSessionActivity(sessionId, { force: true });
  } catch {
    void 0;
  }
  return result;
}

async function provisionProjectScopedAfterLookup(options: {
  sessionId: string;
  chat: ChatFeature;
  projectRepo: ProjectRepository;
  source?: ProvisionSessionSource;
}): Promise<{ status: "ready"; workingDir: string; containerId: string }> {
  const { sessionId, chat, projectRepo, source } = options;
  if (!chat.projectId) {
    throw new Error(
      `Chat session ${sessionId} has neither projectId nor workspaceId`
    );
  }
  const project = await projectRepo.getById(chat.projectId);
  if (!project) {
    throw new Error(`Project not found for chat session: ${sessionId}`);
  }
  return provisionProjectScopedSandbox({
    sessionId,
    chat,
    project,
    source
  });
}

async function provisionProjectScopedSandbox(options: {
  sessionId: string;
  chat: ChatFeature;
  project: Project;
  source?: ProvisionSessionSource;
}): Promise<{ status: "ready"; workingDir: string; containerId: string }> {
  const { sessionId, chat, project, source } = options;
  assertSafeBranch(chat.branchName);
  const workingDir = WORKSPACE_MOUNT;
  const localPath = resolveLocalFolderPath(project, source);
  const { getSandboxRuntime } = await import("./sandboxRuntime/resolve.js");
  const githubOAuth = new GithubOAuthService();

  if (localPath) {
    const hostPath = await assertLocalFolderPath(localPath);
    const wt = await ensureSessionWorktree({
      canonicalKey: hostPath,
      projectId: project.id,
      sessionId,
      branchName: chat.branchName
    });
    const handle = await getSandboxRuntime().createSession(
      sessionId,
      await sandboxSessionCreateOpts(sessionId, [
        { hostPath: wt.workDir, containerPath: WORKSPACE_MOUNT },
        {
          hostPath: wt.gitCanonicalHostPath,
          containerPath: canonicalGitContainerPath(project.id)
        }
      ])
    );
    if (handle.runtime !== "docker") {
      throw new Error(
        "Local folder workspaces require the Docker sandbox runtime"
      );
    }
    await execFileAsync("docker", [
      "exec",
      handle.ref,
      "git",
      "-C",
      workingDir,
      "config",
      "core.fileMode",
      "false"
    ]).catch(() => {});
    return { status: "ready", workingDir, containerId: handle.ref };
  }

  const handle = await getSandboxRuntime().createSession(
    sessionId,
    await sandboxSessionCreateOpts(sessionId)
  );
  const containerName = handle.ref;
  const containerId = handle.ref;
  const repoInitialized = await isRepoInitialized(containerName);
  if (!repoInitialized) {
    if (project.source !== "github") {
      throw new Error(
        `Cannot materialize project source "${project.source}" — connect a local folder or GitHub repo.`
      );
    }
    const token = await githubOAuth.getAccessToken(chat.userId);
    await cloneGithubIntoVolume({
      containerName,
      project,
      branch: chat.branchName,
      token: token ?? undefined
    });
  }
  await execFileAsync("docker", [
    "exec",
    containerName,
    "git",
    "-C",
    workingDir,
    "config",
    "core.fileMode",
    "false"
  ]).catch(() => {});
  return { status: "ready", workingDir, containerId };
}

async function provisionWorkspaceScopedSandbox(options: {
  sessionId: string;
  workspaceId: string;
  userId: string;
  branchName: string;
}): Promise<{ status: "ready"; workingDir: string; containerId: string }> {
  const { sessionId, workspaceId, userId, branchName } = options;
  assertSafeBranch(branchName);
  const workspaceRepo = new WorkspaceRepository();
  const projectRepo = new ProjectRepository();
  const githubOAuth = new GithubOAuthService();
  const members = await workspaceRepo.listMembers(workspaceId);
  if (members.length === 0) {
    throw new Error(
      `Workspace ${workspaceId} has no member projects — add projects before starting a chat`
    );
  }

  const memberProjects: Array<{
    member: WorkspaceProject;
    project: Project;
  }> = [];
  for (const member of members) {
    const project = await projectRepo.getById(member.projectId);
    if (!project) {
      throw new Error(
        `Member project ${member.projectId} (${member.repoName}) not found`
      );
    }
    memberProjects.push({ member, project });
  }

  const bindMounts: BindMount[] = [];
  const githubMembers: Array<{
    member: WorkspaceProject;
    project: Project;
  }> = [];

  for (const { member, project } of memberProjects) {
    const localPath = resolveLocalFolderPath(project);
    if (localPath) {
      const hostPath = await assertLocalFolderPath(localPath);
      const wt = await ensureSessionWorktree({
        canonicalKey: hostPath,
        projectId: project.id,
        sessionId,
        branchName
      });
      bindMounts.push({
        hostPath: wt.workDir,
        containerPath: `${WORKSPACE_MOUNT}/${member.repoName}`
      });
      bindMounts.push({
        hostPath: wt.gitCanonicalHostPath,
        containerPath: canonicalGitContainerPath(project.id)
      });
    } else if (project.source === "github") {
      githubMembers.push({ member, project });
    } else {
      throw new Error(
        `Cannot materialize member "${member.repoName}" source "${project.source}"`
      );
    }
  }

  const { getSandboxRuntime } = await import("./sandboxRuntime/resolve.js");
  const handle = await getSandboxRuntime().createSession(
    sessionId,
    await sandboxSessionCreateOpts(
      sessionId,
      bindMounts.length > 0 ? bindMounts : undefined,
      workspaceId
    )
  );
  if (handle.runtime !== "docker") {
    throw new Error("Workspace sessions require the Docker sandbox runtime");
  }
  const containerName = handle.ref;

  await execFileAsync("docker", [
    "exec",
    containerName,
    "sh",
    "-c",
    `mkdir -p "${WORKSPACE_MOUNT}"`
  ]).catch(() => {});

  const token = githubMembers.length
    ? ((await githubOAuth.getAccessToken(userId)) ?? undefined)
    : undefined;

  for (const { member, project } of githubMembers) {
    const target = `${WORKSPACE_MOUNT}/${member.repoName}`;
    const ready = await isRepoInitializedAt(containerName, target);
    if (ready) continue;
    await cloneGithubIntoVolume({
      containerName,
      project,
      branch: branchName,
      token,
      repoName: member.repoName
    });
  }

  for (const { member } of memberProjects) {
    const target = `${WORKSPACE_MOUNT}/${member.repoName}`;
    await execFileAsync("docker", [
      "exec",
      containerName,
      "git",
      "-C",
      target,
      "config",
      "core.fileMode",
      "false"
    ]).catch(() => {});
  }

  return {
    status: "ready",
    workingDir: WORKSPACE_MOUNT,
    containerId: containerName
  };
}

export function workspacePrepareSessionId(workspaceId: string): string {
  return `wsa-${workspaceId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40)}`;
}

/** Ephemeral sandbox used by workspace Analyze: clone, install, cache. */
export async function provisionWorkspacePrepareSandbox(options: {
  workspaceId: string;
  userId: string;
}): Promise<{ sessionId: string; containerId: string }> {
  const sessionId = workspacePrepareSessionId(options.workspaceId);
  const branchName = `analyze-${options.workspaceId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
  const result = await provisionWorkspaceScopedSandbox({
    sessionId,
    workspaceId: options.workspaceId,
    userId: options.userId,
    branchName
  });
  return { sessionId, containerId: result.containerId };
}

export interface SessionRepoInfo {
  containerName: string;
  repoDir: string;
  workingDir: string;
  sessionRoot: string;
  /** Present for workspace-scoped sessions: map of repoName -> container mount path. */
  worktrees?: Record<string, string>;
  /**
   * Host filesystem paths for local project worktrees (RFC 0005).
   * Used by system-prompt composition to read launch.json / AGENTS.md on the host.
   */
  hostWorktrees?: Record<string, string>;
  /** Host path for project-scoped local session worktree. */
  hostWorkingDir?: string;
}

export async function getSessionRepoInfo(
  sessionId: string
): Promise<SessionRepoInfo> {
  const chatRepo = new ChatFeatureRepository();
  const projectRepo = new ProjectRepository();
  const chat = await chatRepo.getBySessionId(sessionId);
  if (!chat) {
    throw new Error(`No chat/feature found for session: ${sessionId}`);
  }

  if (chat.workspaceId) {
    const workspaceRepo = new WorkspaceRepository();
    const members = await workspaceRepo.listMembers(chat.workspaceId);
    const worktrees: Record<string, string> = {};
    const hostWorktrees: Record<string, string> = {};
    for (const m of members) {
      worktrees[m.repoName] = `${WORKSPACE_MOUNT}/${m.repoName}`;
      const project = await projectRepo.getById(m.projectId);
      if (project?.source === "local" && project.canonicalKey) {
        hostWorktrees[m.repoName] = worktreeWorkDir(project.id, sessionId);
      }
    }
    return {
      containerName: sandboxContainerName(sessionId),
      repoDir: members[0]?.repoName || "repo",
      workingDir: WORKSPACE_MOUNT,
      sessionRoot: WORKSPACE_MOUNT,
      worktrees,
      ...(Object.keys(hostWorktrees).length > 0 ? { hostWorktrees } : {})
    };
  }

  if (!chat.projectId) {
    throw new Error(
      `Chat session ${sessionId} has neither projectId nor workspaceId`
    );
  }
  const project = await projectRepo.getById(chat.projectId);
  if (!project) {
    throw new Error(`Project not found for chat session: ${sessionId}`);
  }
  const repoDir = repoDirForProject(project);
  const hostWorkingDir =
    project.source === "local" && project.canonicalKey
      ? worktreeWorkDir(project.id, sessionId)
      : undefined;
  return {
    containerName: sandboxContainerName(sessionId),
    repoDir,
    workingDir: WORKSPACE_MOUNT,
    sessionRoot: WORKSPACE_MOUNT,
    ...(hostWorkingDir ? { hostWorkingDir } : {})
  };
}

export async function getSessionSandboxStatus(
  sessionId: string
): Promise<SandboxStatus> {
  const workingDir = WORKSPACE_MOUNT;
  const containerName = sandboxContainerName(sessionId);
  let containerId: string | undefined;
  let running: boolean;
  try {
    const { stdout } = await execFileAsync("docker", [
      "inspect",
      "-f",
      "{{.Id}} {{.State.Running}}",
      containerName
    ]);
    const [id, isRunning] = stdout.trim().split(/\s+/);
    containerId = id;
    running = isRunning === "true";
  } catch {
    return { status: "absent", workingDir, running: false };
  }
  const empty = running ? !(await isRepoInitialized(containerName)) : true;
  return {
    status: empty ? "empty" : "ready",
    workingDir,
    containerId,
    running
  };
}

export async function destroySessionSandbox(sessionId: string): Promise<void> {
  try {
    const { destroySessionAppDatabases } = await import("./sessionAppDb.js");
    await destroySessionAppDatabases(sessionId);
  } catch (err) {
    console.warn(
      `[sessionSandbox] app DB teardown failed for ${sessionId}:`,
      err instanceof Error ? err.message : err
    );
  }
  try {
    await pruneLocalSessionWorktrees(sessionId);
  } catch (err) {
    console.warn(
      `[sessionSandbox] worktree prune failed for ${sessionId}:`,
      err instanceof Error ? err.message : err
    );
  }
  const { getSandboxRuntime } = await import("./sandboxRuntime/resolve.js");
  await getSandboxRuntime().destroySession(sessionId);
}

async function pruneLocalSessionWorktrees(sessionId: string): Promise<void> {
  const chatRepo = new ChatFeatureRepository();
  const projectRepo = new ProjectRepository();
  const chat = await chatRepo.getBySessionId(sessionId);
  if (!chat) return;

  if (chat.workspaceId) {
    const workspaceRepo = new WorkspaceRepository();
    const members = await workspaceRepo.listMembers(chat.workspaceId);
    for (const member of members) {
      const project = await projectRepo.getById(member.projectId);
      if (!project || project.source !== "local" || !project.canonicalKey) {
        continue;
      }
      await removeSessionWorktree({
        canonicalKey: project.canonicalKey,
        projectId: project.id,
        sessionId
      });
    }
    return;
  }

  if (!chat.projectId) return;
  const project = await projectRepo.getById(chat.projectId);
  if (!project || project.source !== "local" || !project.canonicalKey) return;
  await removeSessionWorktree({
    canonicalKey: project.canonicalKey,
    projectId: project.id,
    sessionId
  });
}
