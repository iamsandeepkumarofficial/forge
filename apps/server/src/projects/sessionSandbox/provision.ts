import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ChatFeatureRepository } from "../../catalog/chatFeatureRepository.js";
import { ProjectRepository } from "../../catalog/projectRepository.js";
import { WorkspaceRepository } from "../../catalog/workspaceRepository.js";
import { GithubOAuthService } from "../../integrations/githubOAuth.js";
import type { ChatFeature, Project, WorkspaceProject } from "@forge/db";
import { WORKSPACE_MOUNT } from "./constants.js";
import {
  assertLocalFolderPath,
  assertSafeBranch,
  cloneGithubIntoVolume,
  isRepoInitialized,
  isRepoInitializedAt,
  type LocalFolderSource
} from "./materialize.js";
import type { BindMount, NamedVolumeMount } from "../sandboxRuntime/types.js";
import {
  canonicalGitContainerPath,
  ensureSessionWorktree
} from "../localWorktree.js";
const execFileAsync = promisify(execFile);

export type ProvisionSessionSource = LocalFolderSource;

const provisionInFlight = new Map<
  string,
  Promise<{ status: "ready"; workingDir: string; containerId: string }>
>();

export function resolveLocalFolderPath(
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

export async function sandboxSessionCreateOpts(options: {
  sessionId: string;
  bindMounts?: BindMount[];
  workspaceId?: string;
}): Promise<{
  bindMounts?: BindMount[];
  namedVolumes?: NamedVolumeMount[];
  containerEnv: Record<string, string>;
  image?: string;
}> {
  const { sessionId, bindMounts, workspaceId } = options;
  const { resolveSessionEnv } =
    await import("../../services/parameters/resolveSessionEnv.js");
  const env = await resolveSessionEnv(sessionId);
  let image: string | undefined;
  let namedVolumes: NamedVolumeMount[] | undefined;
  if (workspaceId) {
    const { isHostSession } = await import("../sandboxRuntime/resolve.js");
    const { selectSandboxImageForWorkspace } =
      await import("../sandboxImageSelect.js");
    image = await selectSandboxImageForWorkspace(workspaceId);
    if (!(await isHostSession(sessionId))) {
      const { ensureWorkspaceDepsVolume, DEPS_CACHE_MOUNT } =
        await import("../workspaceDepsCache.js");
      const volumeName = await ensureWorkspaceDepsVolume(workspaceId, {
        hostMode: false
      });
      namedVolumes = [{ volumeName, containerPath: DEPS_CACHE_MOUNT }];
    }
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
  const key = sessionId.trim();
  const existing = provisionInFlight.get(key);
  if (existing) return existing;

  const work = provisionSessionSandboxOnce(key, options).finally(() => {
    provisionInFlight.delete(key);
  });
  provisionInFlight.set(key, work);
  return work;
}

async function provisionSessionSandboxOnce(
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

  const { rememberSessionExecutionTarget } =
    await import("../sandboxRuntime/resolve.js");
  rememberSessionExecutionTarget(sessionId, chat.executionTarget ?? "local");

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
    const { touchSessionActivity } = await import("../sessionActivity.js");
    await touchSessionActivity(sessionId, { force: true });
  } catch {
    void 0;
  }
  return result;
}

export async function provisionProjectScopedAfterLookup(options: {
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

async function disableGitFileMode(options: {
  containerName?: string;
  hostPath?: string;
  workingDir: string;
}): Promise<void> {
  if (options.hostPath) {
    const { disableGitFileModeOnHost } = await import("./provisionHost.js");
    await disableGitFileModeOnHost(options.hostPath);
    return;
  }
  if (!options.containerName) return;
  await execFileAsync("docker", [
    "exec",
    options.containerName,
    "git",
    "-C",
    options.workingDir,
    "config",
    "core.fileMode",
    "false"
  ]).catch(() => {});
}

export async function provisionProjectScopedSandbox(options: {
  sessionId: string;
  chat: ChatFeature;
  project: Project;
  source?: ProvisionSessionSource;
}): Promise<{ status: "ready"; workingDir: string; containerId: string }> {
  const { sessionId, chat, project, source } = options;
  assertSafeBranch(chat.branchName);
  const workingDir = WORKSPACE_MOUNT;
  const localPath = resolveLocalFolderPath(project, source);
  if (localPath) {
    const { provisionLocalProjectSandbox } =
      await import("./provisionLocal.js");
    return provisionLocalProjectSandbox({
      sessionId,
      chat,
      project,
      localPath
    });
  }

  const { getSandboxRuntime } = await import("../sandboxRuntime/resolve.js");
  const githubOAuth = new GithubOAuthService();
  const handle = await (
    await getSandboxRuntime(sessionId)
  ).createSession(sessionId, await sandboxSessionCreateOpts({ sessionId }));
  const containerName = handle.ref;
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
  await disableGitFileMode({ containerName, workingDir });
  return { status: "ready", workingDir, containerId: containerName };
}

async function loadWorkspaceMemberProjects(
  workspaceId: string
): Promise<Array<{ member: WorkspaceProject; project: Project }>> {
  const workspaceRepo = new WorkspaceRepository();
  const projectRepo = new ProjectRepository();
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
  return memberProjects;
}

async function partitionMemberMounts(options: {
  sessionId: string;
  branchName: string;
  memberProjects: Array<{ member: WorkspaceProject; project: Project }>;
}): Promise<{
  bindMounts: BindMount[];
  githubMembers: Array<{ member: WorkspaceProject; project: Project }>;
}> {
  const bindMounts: BindMount[] = [];
  const githubMembers: Array<{
    member: WorkspaceProject;
    project: Project;
  }> = [];
  for (const { member, project } of options.memberProjects) {
    const localPath = resolveLocalFolderPath(project);
    if (localPath) {
      const hostPath = await assertLocalFolderPath(localPath);
      const wt = await ensureSessionWorktree({
        canonicalKey: hostPath,
        projectId: project.id,
        sessionId: options.sessionId,
        branchName: options.branchName
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
  return { bindMounts, githubMembers };
}

async function finalizeWorkspaceContainer(options: {
  containerName: string;
  branchName: string;
  userId: string;
  memberProjects: Array<{ member: WorkspaceProject; project: Project }>;
  githubMembers: Array<{ member: WorkspaceProject; project: Project }>;
}): Promise<void> {
  await execFileAsync("docker", [
    "exec",
    options.containerName,
    "sh",
    "-c",
    `mkdir -p "${WORKSPACE_MOUNT}"`
  ]).catch(() => {});
  const githubOAuth = new GithubOAuthService();
  const token = options.githubMembers.length
    ? ((await githubOAuth.getAccessToken(options.userId)) ?? undefined)
    : undefined;
  for (const { member, project } of options.githubMembers) {
    const target = `${WORKSPACE_MOUNT}/${member.repoName}`;
    const ready = await isRepoInitializedAt(options.containerName, target);
    if (ready) continue;
    await cloneGithubIntoVolume({
      containerName: options.containerName,
      project,
      branch: options.branchName,
      token,
      repoName: member.repoName
    });
  }
  for (const { member } of options.memberProjects) {
    const target = `${WORKSPACE_MOUNT}/${member.repoName}`;
    await execFileAsync("docker", [
      "exec",
      options.containerName,
      "git",
      "-C",
      target,
      "config",
      "core.fileMode",
      "false"
    ]).catch(() => {});
  }
}

export async function provisionWorkspaceScopedSandbox(options: {
  sessionId: string;
  workspaceId: string;
  userId: string;
  branchName: string;
}): Promise<{ status: "ready"; workingDir: string; containerId: string }> {
  const { sessionId, workspaceId, userId, branchName } = options;
  assertSafeBranch(branchName);
  const memberProjects = await loadWorkspaceMemberProjects(workspaceId);
  const { bindMounts, githubMembers } = await partitionMemberMounts({
    sessionId,
    branchName,
    memberProjects
  });
  const { getSandboxRuntime } = await import("../sandboxRuntime/resolve.js");
  const handle = await (
    await getSandboxRuntime(sessionId)
  ).createSession(
    sessionId,
    await sandboxSessionCreateOpts({
      sessionId,
      bindMounts: bindMounts.length > 0 ? bindMounts : undefined,
      workspaceId
    })
  );
  if (handle.runtime === "host") {
    const { finalizeHostWorkspace } = await import("./provisionHost.js");
    const hostReady = await finalizeHostWorkspace({
      bindMounts,
      githubMemberCount: githubMembers.length
    });
    return { ...hostReady, containerId: handle.ref };
  }
  if (handle.runtime !== "docker") {
    throw new Error(
      "Workspace sessions require the Docker or host sandbox runtime"
    );
  }
  await finalizeWorkspaceContainer({
    containerName: handle.ref,
    branchName,
    userId,
    memberProjects,
    githubMembers
  });
  return {
    status: "ready",
    workingDir: WORKSPACE_MOUNT,
    containerId: handle.ref
  };
}
