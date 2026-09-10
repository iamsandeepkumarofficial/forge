import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import {
  ensureWorkspacesRoot,
  workspaceMemberDir
} from "../services/project/projectsRoot.js";

const execFileAsync = promisify(execFile);
const N_10 = 10;
const N_1024 = 1024;

async function git(
  cwd: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("git", ["-C", cwd, ...args], {
    maxBuffer: N_10 * N_1024 * N_1024
  });
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function isGitRepo(dir: string): Promise<boolean> {
  try {
    await git(dir, ["rev-parse", "--git-dir"]);
    return true;
  } catch {
    return false;
  }
}

export async function resolveDefaultBranch(repoPath: string): Promise<string> {
  try {
    const { stdout } = await git(repoPath, [
      "symbolic-ref",
      "--short",
      "refs/remotes/origin/HEAD"
    ]);
    const m = stdout.trim().match(/origin\/(.+)/);
    if (m?.[1]) return m[1];
  } catch {
    void 0;
  }
  try {
    const { stdout } = await git(repoPath, [
      "rev-parse",
      "--abbrev-ref",
      "HEAD"
    ]);
    if (stdout.trim()) return stdout.trim();
  } catch {
    void 0;
  }
  return "main";
}

export function resolveSourceRef(options: {
  sourceRef?: string | null;
  defaultBranch: string;
}): string {
  const raw = options.sourceRef?.trim();
  return raw && raw.length > 0 ? raw : options.defaultBranch;
}

export async function ensureWorkspaceMemberCopy(options: {
  workspaceId: string;
  repoName: string;
  canonicalKey: string;
  sourceRef?: string | null;
}): Promise<{ memberDir: string; sourceRef: string }> {
  const { workspaceId, repoName, canonicalKey } = options;
  await ensureWorkspacesRoot();

  if (!(await pathExists(canonicalKey))) {
    throw new Error(
      `Canonical path missing for workspace member "${repoName}": ${canonicalKey}`
    );
  }
  if (!(await isGitRepo(canonicalKey))) {
    throw new Error(
      `Canonical path is not a git repo for workspace member "${repoName}": ${canonicalKey}`
    );
  }

  const defaultBranch = await resolveDefaultBranch(canonicalKey);
  const sourceRef = resolveSourceRef({
    sourceRef: options.sourceRef,
    defaultBranch
  });
  const memberDir = workspaceMemberDir(workspaceId, repoName);
  const parent = path.dirname(memberDir);
  await fs.mkdir(parent, { recursive: true });

  if (await isGitRepo(memberDir)) {
    return { memberDir, sourceRef };
  }

  if (await pathExists(memberDir)) {
    await fs.rm(memberDir, { recursive: true, force: true });
  }

  await execFileAsync(
    "git",
    ["clone", "--local", "--no-hardlinks", canonicalKey, memberDir],
    { maxBuffer: N_10 * N_1024 * N_1024 }
  );

  try {
    await git(memberDir, ["checkout", "-B", sourceRef, sourceRef]);
  } catch {
    try {
      await git(memberDir, [
        "checkout",
        "-B",
        sourceRef,
        `origin/${sourceRef}`
      ]);
    } catch {
      await git(memberDir, ["checkout", "-B", sourceRef]).catch(() => {});
    }
  }

  return { memberDir, sourceRef };
}

export async function removeWorkspaceMemberCopy(options: {
  workspaceId: string;
  repoName: string;
}): Promise<void> {
  const memberDir = workspaceMemberDir(options.workspaceId, options.repoName);
  await fs.rm(memberDir, { recursive: true, force: true }).catch(() => {});
}

export async function removeWorkspaceSessionTree(options: {
  workspaceId: string;
  sessionId: string;
}): Promise<void> {
  const { workspaceSessionRoot } =
    await import("../services/project/projectsRoot.js");
  const root = workspaceSessionRoot(options.workspaceId, options.sessionId);
  await fs.rm(root, { recursive: true, force: true }).catch(() => {});

  const wsRoot = path.join(
    (
      await import("../services/project/projectsRoot.js")
    ).resolveWorkspacesRoot(),
    options.workspaceId
  );
  try {
    const entries = await fs.readdir(wsRoot, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory() || e.name === "sessions") continue;
      const memberDir = path.join(wsRoot, e.name);
      if (await isGitRepo(memberDir)) {
        await git(memberDir, ["worktree", "prune"]).catch(() => {});
      }
    }
  } catch {
    void 0;
  }
}

export async function removeEntireWorkspaceCopies(
  workspaceId: string
): Promise<void> {
  const { resolveWorkspacesRoot } =
    await import("../services/project/projectsRoot.js");
  const dir = path.join(resolveWorkspacesRoot(), workspaceId);
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
}
