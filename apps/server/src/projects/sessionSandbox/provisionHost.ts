import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { BindMount } from "../sandboxRuntime/types.js";
import { WORKSPACE_MOUNT } from "./constants.js";

const execFileAsync = promisify(execFile);

export async function disableGitFileModeOnHost(
  hostPath: string
): Promise<void> {
  await execFileAsync("git", [
    "-C",
    hostPath,
    "config",
    "core.fileMode",
    "false"
  ]).catch(() => {});
}

export async function finalizeHostWorkspace(options: {
  bindMounts: BindMount[];
  githubMemberCount: number;
}): Promise<{ status: "ready"; workingDir: string; containerId: string }> {
  if (options.githubMemberCount > 0) {
    throw new Error(
      "Host mode does not yet materialize GitHub workspace members; use local folders or SANDBOX_RUNTIME=docker"
    );
  }
  for (const mount of options.bindMounts) {
    await disableGitFileModeOnHost(mount.hostPath);
  }
  return {
    status: "ready",
    workingDir: WORKSPACE_MOUNT,
    containerId: ""
  };
}
