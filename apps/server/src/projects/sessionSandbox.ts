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
import type { BindMount } from "./sandboxRuntime/types.js";

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

  if (chat.workspaceId) {
    return provisionWorkspaceScopedSandbox({
      sessionId,
      chat,
      workspaceId: chat.workspaceId
    });
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
  return provisionProjectScopedSandbox({
    sessionId,
    chat,
    project,
    source: options?.source
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
    const handle = await getSandboxRuntime().createSession(sessionId, {
      bindMounts: [{ hostPath, containerPath: WORKSPACE_MOUNT }]
    });
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

  const handle = await getSandboxRuntime().createSession(sessionId);
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
  chat: ChatFeature;
  workspaceId: string;
}): Promise<{ status: "ready"; workingDir: string; containerId: string }> {
  const { sessionId, chat, workspaceId } = options;
  assertSafeBranch(chat.branchName);
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
      bindMounts.push({
        hostPath,
        containerPath: `${WORKSPACE_MOUNT}/${member.repoName}`
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
  const handle = await getSandboxRuntime().createSession(sessionId, {
    bindMounts: bindMounts.length > 0 ? bindMounts : undefined
  });
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
    ? ((await githubOAuth.getAccessToken(chat.userId)) ?? undefined)
    : undefined;

  for (const { member, project } of githubMembers) {
    const target = `${WORKSPACE_MOUNT}/${member.repoName}`;
    const ready = await isRepoInitializedAt(containerName, target);
    if (ready) continue;
    await cloneGithubIntoVolume({
      containerName,
      project,
      branch: chat.branchName,
      token,
      repoName: member.repoName
    });
  }

  for (const { member, project } of memberProjects) {
    if (project.source !== "local") continue;
    const target = `${WORKSPACE_MOUNT}/${member.repoName}`;
    await execFileAsync("docker", [
      "exec",
      containerName,
      "sh",
      "-c",
      `cd "${target}" && git checkout -B "${chat.branchName}" 2>/dev/null || true`
    ]).catch(() => {});
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

export interface SessionRepoInfo {
  containerName: string;
  repoDir: string;
  workingDir: string;
  sessionRoot: string;
  /** Present for workspace-scoped sessions: map of repoName -> mount path. */
  worktrees?: Record<string, string>;
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
    for (const m of members) {
      worktrees[m.repoName] = `${WORKSPACE_MOUNT}/${m.repoName}`;
    }
    return {
      containerName: sandboxContainerName(sessionId),
      repoDir: members[0]?.repoName || "repo",
      workingDir: WORKSPACE_MOUNT,
      sessionRoot: WORKSPACE_MOUNT,
      worktrees
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
  return {
    containerName: sandboxContainerName(sessionId),
    repoDir,
    workingDir: WORKSPACE_MOUNT,
    sessionRoot: WORKSPACE_MOUNT
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
  const { getSandboxRuntime } = await import("./sandboxRuntime/resolve.js");
  await getSandboxRuntime().destroySession(sessionId);
}
