import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import { ProjectRepository } from "../catalog/projectRepository.js";
import { GithubOAuthService } from "../integrations/githubOAuth.js";
import type { ChatFeature, Project } from "@forge/db";
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
  repoDirForProject,
  type LocalFolderSource
} from "./sessionSandbox/materialize.js";

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
  const githubOAuth = new GithubOAuthService();
  const chat: ChatFeature | null = await chatRepo.getBySessionId(sessionId);
  if (!chat) {
    throw new Error(`No chat/feature found for session: ${sessionId}`);
  }
  const project = await projectRepo.getById(chat.projectId);
  if (!project) {
    throw new Error(`Project not found for chat session: ${sessionId}`);
  }
  assertSafeBranch(chat.branchName);
  const workingDir = WORKSPACE_MOUNT;
  const localPath = resolveLocalFolderPath(project, options?.source);
  const { getSandboxRuntime } = await import("./sandboxRuntime/resolve.js");

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

export interface SessionRepoInfo {
  containerName: string;
  repoDir: string;
  workingDir: string;
  sessionRoot: string;
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
