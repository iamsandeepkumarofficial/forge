import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import { ProjectRepository } from "../catalog/projectRepository.js";
import { WorkspaceRepository } from "../catalog/workspaceRepository.js";
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
  isRepoInitialized,
  isRepoInitializedAt,
  repoDirForProject
} from "./sessionSandbox/materialize.js";
import { removeSessionWorktree, worktreeWorkDir } from "./localWorktree.js";
import {
  provisionSessionSandbox,
  provisionWorkspaceScopedSandbox
} from "./sessionSandbox/provision.js";

export { provisionSessionSandbox };
export type { ProvisionSessionSource } from "./sessionSandbox/provision.js";

const N_24 = 24;
const N_40 = 40;

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

export function workspacePrepareSessionId(workspaceId: string): string {
  return `wsa-${workspaceId.replace(/[^a-zA-Z0-9]/g, "").slice(0, N_40)}`;
}

export async function provisionWorkspacePrepareSandbox(options: {
  workspaceId: string;
  userId: string;
}): Promise<{ sessionId: string; containerId: string }> {
  const sessionId = workspacePrepareSessionId(options.workspaceId);
  const branchName = `analyze-${options.workspaceId.replace(/[^a-zA-Z0-9]/g, "").slice(0, N_24)}`;
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

  worktrees?: Record<string, string>;

  hostWorktrees?: Record<string, string>;

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

  const { resolveSandboxRuntimeKindForSession } =
    await import("./sandboxRuntime/resolve.js");
  const kind = await resolveSandboxRuntimeKindForSession(sessionId);
  const dockerName = sandboxContainerName(sessionId);

  if (chat.workspaceId) {
    return workspaceSessionRepoInfo({
      sessionId,
      workspaceId: chat.workspaceId,
      kind,
      dockerName,
      projectRepo
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
  const repoDir = repoDirForProject(project);
  const repoMount = `${WORKSPACE_MOUNT}/${repoDir}`;
  const worktrees = { [repoDir]: repoMount };
  const hostWorktrees: Record<string, string> = {};
  const hostGitDir =
    project.source === "local" && project.canonicalKey
      ? worktreeWorkDir(project.id, sessionId)
      : undefined;
  const fs = await import("node:fs");
  const path = await import("node:path");
  if (hostGitDir && fs.existsSync(hostGitDir)) {
    hostWorktrees[repoDir] = hostGitDir;
  }
  const { hostManagedSessionRoot } =
    await import("./sandboxRuntime/hostSessionPaths.js");
  const hostWorkspaceView = path.join(
    hostManagedSessionRoot(sessionId),
    "workspace"
  );
  const hostRef =
    kind === "host"
      ? fs.existsSync(hostWorkspaceView)
        ? hostWorkspaceView
        : (hostGitDir ?? dockerName)
      : undefined;
  const hostWorkingDir = fs.existsSync(hostWorkspaceView)
    ? hostWorkspaceView
    : hostGitDir;
  return {
    containerName: kind === "host" && hostRef ? hostRef : dockerName,
    repoDir,
    workingDir: WORKSPACE_MOUNT,
    sessionRoot: WORKSPACE_MOUNT,
    worktrees,
    ...(Object.keys(hostWorktrees).length > 0 ? { hostWorktrees } : {}),
    ...(hostWorkingDir ? { hostWorkingDir } : {})
  };
}

async function workspaceSessionRepoInfo(options: {
  sessionId: string;
  workspaceId: string;
  kind: string;
  dockerName: string;
  projectRepo: ProjectRepository;
}): Promise<SessionRepoInfo> {
  const { sessionId, workspaceId, kind, dockerName, projectRepo } = options;
  const workspaceRepo = new WorkspaceRepository();
  const members = await workspaceRepo.listMembers(workspaceId);
  const worktrees: Record<string, string> = {};
  const hostWorktrees: Record<string, string> = {};
  const { workspaceSessionMemberDir, workspaceMemberDir } =
    await import("../services/project/projectsRoot.js");
  const { hostManagedSessionRoot } =
    await import("./sandboxRuntime/hostSessionPaths.js");
  const fs = await import("node:fs");
  const path = await import("node:path");
  for (const m of members) {
    worktrees[m.repoName] = `${WORKSPACE_MOUNT}/${m.repoName}`;
    const project = await projectRepo.getById(m.projectId);
    if (project?.source === "local" && project.canonicalKey) {
      const sessionMember = workspaceSessionMemberDir({
        workspaceId,
        sessionId,
        repoName: m.repoName
      });
      const durable = workspaceMemberDir(workspaceId, m.repoName);
      if (fs.existsSync(sessionMember)) {
        hostWorktrees[m.repoName] = sessionMember;
      } else if (fs.existsSync(durable)) {
        hostWorktrees[m.repoName] = durable;
      }
    }
  }
  const hostWorkspaceView = path.join(
    hostManagedSessionRoot(sessionId),
    "workspace"
  );
  const hostRef =
    kind === "host"
      ? fs.existsSync(hostWorkspaceView)
        ? hostWorkspaceView
        : hostManagedSessionRoot(sessionId)
      : Object.values(hostWorktrees)[0];
  const hostWorkingDir = fs.existsSync(hostWorkspaceView)
    ? hostWorkspaceView
    : undefined;
  return {
    containerName: kind === "host" && hostRef ? hostRef : dockerName,
    repoDir: members[0]?.repoName || "repo",
    workingDir: WORKSPACE_MOUNT,
    sessionRoot: WORKSPACE_MOUNT,
    worktrees,
    ...(Object.keys(hostWorktrees).length > 0 ? { hostWorktrees } : {}),
    ...(hostWorkingDir ? { hostWorkingDir } : {})
  };
}

export async function getSessionSandboxStatus(
  sessionId: string
): Promise<SandboxStatus> {
  const workingDir = WORKSPACE_MOUNT;
  const { getSandboxRuntime, isHostSession } =
    await import("./sandboxRuntime/resolve.js");
  const runtime = await getSandboxRuntime(sessionId);
  const status = await runtime.getStatus(sessionId);
  if (status.status === "absent" || !status.running) {
    return {
      status: "absent",
      workingDir: status.workingDir ?? workingDir,
      running: false,
      ...(status.ref ? { containerId: status.ref } : {})
    };
  }

  if (await isHostSession(sessionId)) {
    const info = await getSessionRepoInfo(sessionId);
    const root = info.hostWorkingDir ?? info.containerName;
    const empty = await hostWorkspaceLooksEmpty(root);
    return {
      status: empty ? "empty" : "ready",
      workingDir,
      containerId: status.ref ?? root,
      running: true
    };
  }

  const containerName = sandboxContainerName(sessionId);
  let empty: boolean;
  try {
    const info = await getSessionRepoInfo(sessionId);
    const mounts = mountsForSandboxReadyCheck(info.worktrees);
    const checks = await Promise.all(
      mounts.map((mount) => isRepoInitializedAt(containerName, mount))
    );
    empty = !checks.some(Boolean);
  } catch {
    empty = !(await isRepoInitialized(containerName));
  }
  return {
    status: empty ? "empty" : "ready",
    workingDir,
    containerId: status.ref ?? containerName,
    running: true
  };
}

async function hostWorkspaceLooksEmpty(root: string): Promise<boolean> {
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    try {
      await fs.access(path.join(root, ".git"));
      return false;
    } catch {
      void 0;
    }
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      if (entry.name.startsWith(".")) continue;
      try {
        await fs.access(path.join(root, entry.name, ".git"));
        return false;
      } catch {
        void 0;
      }
    }
    return true;
  } catch {
    return true;
  }
}

export function mountsForSandboxReadyCheck(
  worktrees?: Record<string, string>
): string[] {
  if (worktrees && Object.keys(worktrees).length > 0) {
    return Object.values(worktrees);
  }
  return [WORKSPACE_MOUNT];
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
  const { forgetSessionRuntimeKind, getSandboxRuntime } =
    await import("./sandboxRuntime/resolve.js");
  await (await getSandboxRuntime(sessionId)).destroySession(sessionId);
  forgetSessionRuntimeKind(sessionId);
}

async function pruneLocalSessionWorktrees(sessionId: string): Promise<void> {
  const chatRepo = new ChatFeatureRepository();
  const projectRepo = new ProjectRepository();
  const chat = await chatRepo.getBySessionId(sessionId);
  if (!chat) return;

  if (chat.workspaceId) {
    const { removeWorkspaceSessionTree } =
      await import("./workspaceMaterialize.js");
    await removeWorkspaceSessionTree({
      workspaceId: chat.workspaceId,
      sessionId
    });
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
