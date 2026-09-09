import fs from "node:fs/promises";
import path from "node:path";
import { WORKSPACE_MOUNT } from "../sessionSandbox/constants.js";
import type { BindMount } from "./types.js";
import { hostManagedSessionRoot } from "./hostSessionPaths.js";

export type WorkspaceMount = {
  containerPath: string;
  hostPath: string;
};

export function normalizeContainerPath(p: string): string {
  const cleaned = p.replace(/\\/g, "/").replace(/\/+$/, "");
  return cleaned || "/";
}

function isWorkspaceContainerPath(containerPath: string): boolean {
  const p = normalizeContainerPath(containerPath);
  return p === WORKSPACE_MOUNT || p.startsWith(`${WORKSPACE_MOUNT}/`);
}

export function workspaceMountsFromBinds(
  bindMounts: BindMount[] | undefined
): WorkspaceMount[] {
  const mounts = (bindMounts ?? [])
    .filter((m) => isWorkspaceContainerPath(m.containerPath))
    .map((m) => ({
      containerPath: normalizeContainerPath(m.containerPath),
      hostPath: path.resolve(m.hostPath)
    }));
  mounts.sort((a, b) => b.containerPath.length - a.containerPath.length);
  return mounts;
}

function workspaceHostPath(mounts: WorkspaceMount[]): string | undefined {
  return mounts.find((m) => m.containerPath === WORKSPACE_MOUNT)?.hostPath;
}

function memberNameFromWorkspaceMount(containerPath: string): string | null {
  const p = normalizeContainerPath(containerPath);
  if (!p.startsWith(`${WORKSPACE_MOUNT}/`)) return null;
  const rest = p.slice(WORKSPACE_MOUNT.length + 1);
  const name = rest.split("/")[0]?.trim();
  return name || null;
}

export async function ensureHostWorkspaceRoot(options: {
  sessionId: string;
  mounts: WorkspaceMount[];
}): Promise<{ root: string; mounts: WorkspaceMount[] }> {
  const exact = workspaceHostPath(options.mounts);
  if (exact) {
    await fs.mkdir(path.join(exact, ".forge-runtime"), { recursive: true });
    return { root: exact, mounts: options.mounts };
  }

  const managed = hostManagedSessionRoot(options.sessionId);
  await fs.mkdir(managed, { recursive: true });
  await fs.mkdir(path.join(managed, ".forge-runtime"), { recursive: true });

  const members = options.mounts
    .map((m) => ({
      name: memberNameFromWorkspaceMount(m.containerPath),
      hostPath: m.hostPath
    }))
    .filter((m): m is { name: string; hostPath: string } => Boolean(m.name));

  if (members.length === 0) {
    return { root: managed, mounts: options.mounts };
  }

  const wsView = path.join(managed, "workspace");
  await fs.mkdir(wsView, { recursive: true });
  const linkType = process.platform === "win32" ? "junction" : "dir";
  for (const member of members) {
    const linkPath = path.join(wsView, member.name);
    await fs.rm(linkPath, { recursive: true, force: true }).catch(() => {});
    try {
      await fs.symlink(member.hostPath, linkPath, linkType);
    } catch (err) {
      console.warn(
        `[host-runtime] failed to link ${member.name} into workspace view: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  const mounts: WorkspaceMount[] = [
    ...options.mounts,
    { containerPath: WORKSPACE_MOUNT, hostPath: wsView }
  ];
  mounts.sort((a, b) => b.containerPath.length - a.containerPath.length);
  return { root: wsView, mounts };
}
