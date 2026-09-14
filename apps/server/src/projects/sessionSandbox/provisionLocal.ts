import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ChatFeature, Project } from "@forge/db";
import { WORKSPACE_MOUNT } from "./constants.js";
import { assertLocalFolderPath, repoDirForProject } from "./materialize.js";
import {
  canonicalGitContainerPath,
  ensureSessionWorktree
} from "../localWorktree.js";
import { sandboxSessionCreateOpts } from "./provision.js";
import { disableGitFileModeOnHost } from "./provisionHost.js";

const execFileAsync = promisify(execFile);

async function disableGitFileModeInContainer(options: {
  containerName: string;
  workingDir: string;
}): Promise<void> {
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

export async function provisionLocalProjectSandbox(options: {
  sessionId: string;
  chat: ChatFeature;
  project: Project;
  localPath: string;
}): Promise<{ status: "ready"; workingDir: string; containerId: string }> {
  const { sessionId, chat, project, localPath } = options;
  const repoDir = repoDirForProject(project);
  const workingDir = WORKSPACE_MOUNT;
  const repoMount = `${WORKSPACE_MOUNT}/${repoDir}`;
  const hostPath = await assertLocalFolderPath(localPath);
  const wt = await ensureSessionWorktree({
    canonicalKey: hostPath,
    projectId: project.id,
    sessionId,
    branchName: chat.branchName
  });
  const { getSandboxRuntime } = await import("../sandboxRuntime/resolve.js");
  const handle = await (
    await getSandboxRuntime(sessionId)
  ).createSession(
    sessionId,
    await sandboxSessionCreateOpts({
      sessionId,
      bindMounts: [
        { hostPath: wt.workDir, containerPath: repoMount },
        {
          hostPath: wt.gitCanonicalHostPath,
          containerPath: canonicalGitContainerPath(project.id)
        }
      ]
    })
  );
  if (handle.runtime === "host") {
    await disableGitFileModeOnHost(wt.workDir);
    return { status: "ready", workingDir, containerId: handle.ref };
  }
  if (handle.runtime !== "docker") {
    throw new Error(
      "Local folder workspaces require the Docker or host sandbox runtime"
    );
  }
  await disableGitFileModeInContainer({
    containerName: handle.ref,
    workingDir: repoMount
  });
  return { status: "ready", workingDir, containerId: handle.ref };
}
