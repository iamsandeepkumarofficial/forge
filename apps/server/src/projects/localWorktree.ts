import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import {
  ensureSessionsRoot,
  sessionWorktreeDir
} from "../services/project/projectsRoot.js";

const execFileAsync = promisify(execFile);

const FORGE_GIT_IDENTITY = {
  name: "Forge Agent",
  email: "forge@local"
} as const;

const DOCKER_NAME_MAX = 48;

export function sanitizeSessionFsName(sessionId: string): string {
  const cleaned = sessionId
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(0, DOCKER_NAME_MAX);
  return cleaned.replace(/^[._-]+/, "") || "session";
}

export function canonicalGitContainerPath(projectId: string): string {
  return `/forge-git/${projectId}`;
}

export function worktreeWorkDir(projectId: string, sessionId: string): string {
  return sessionWorktreeDir(projectId, sanitizeSessionFsName(sessionId));
}

async function git(
  cwd: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("git", ["-C", cwd, ...args], {
    maxBuffer: 10 * 1024 * 1024
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

async function gitConfigGet(
  repoDir: string,
  key: string
): Promise<string | null> {
  try {
    const { stdout } = await git(repoDir, ["config", "--get", key]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function gitConfigSet(
  repoDir: string,
  key: string,
  value: string
): Promise<void> {
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await git(repoDir, ["config", key, value]);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const locked = /could not lock config file|\.lock/i.test(msg);
      if (!locked || attempt === maxAttempts - 1) {
        // If another writer won the race but set the same value, treat as ok.
        const current = await gitConfigGet(repoDir, key);
        if (current === value) return;
        throw err;
      }
      const lockPath = path.join(repoDir, ".git", "config.lock");
      try {
        const st = await fs.stat(lockPath);
        // Stale lock from a crashed writer (common with host+container sharing .git).
        if (Date.now() - st.mtimeMs > 5_000) {
          await fs.rm(lockPath, { force: true });
        }
      } catch {
        /* no lock or can't stat */
      }
      await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
    }
  }
}

async function configureForgeIdentity(repoDir: string): Promise<void> {
  const email = await gitConfigGet(repoDir, "user.email");
  if (email !== FORGE_GIT_IDENTITY.email) {
    await gitConfigSet(repoDir, "user.email", FORGE_GIT_IDENTITY.email);
  }
  const name = await gitConfigGet(repoDir, "user.name");
  if (name !== FORGE_GIT_IDENTITY.name) {
    await gitConfigSet(repoDir, "user.name", FORGE_GIT_IDENTITY.name);
  }
  const fileMode = await gitConfigGet(repoDir, "core.fileMode");
  if (fileMode !== "false") {
    await gitConfigSet(repoDir, "core.fileMode", "false").catch(() => {});
  }
}

/**
 * Ensure a canonical local project dir is a real git repo.
 * If no .git exists: init, identity, add-all, initial commit (when non-empty).
 * Existing repos are left alone — Run tab polls provision often and must not
 * rewrite .git/config on every pass (shared with in-container mounts).
 */
export async function ensureCanonicalGitRepo(
  canonicalKey: string
): Promise<void> {
  if (await isGitRepo(canonicalKey)) {
    return;
  }

  await git(canonicalKey, ["init"]);
  await configureForgeIdentity(canonicalKey);
  await git(canonicalKey, ["add", "-A"]);
  const { stdout: status } = await git(canonicalKey, [
    "status",
    "--porcelain"
  ]).catch(() => ({ stdout: "" }));
  if (status.trim()) {
    await git(canonicalKey, ["commit", "-m", "forge: initial import"]);
  } else {
    // worktree add requires at least one commit
    await git(canonicalKey, [
      "commit",
      "--allow-empty",
      "-m",
      "forge: initial import"
    ]);
  }
}

function adminNameFromGitdirFile(contents: string): string | null {
  const match = contents.match(/^\s*gitdir:\s*(.+)\s*$/m);
  if (!match?.[1]) return null;
  const gitdir = match[1].trim();
  const marker = `${path.sep}worktrees${path.sep}`;
  const idx = gitdir.lastIndexOf(marker);
  if (idx < 0) return null;
  return gitdir.slice(idx + marker.length).replace(/\/+$/, "");
}

async function resolveWorktreeAdminName(workDir: string): Promise<string> {
  const pointer = path.join(workDir, ".git");
  const st = await fs.stat(pointer);
  if (!st.isFile()) {
    throw new Error(`Expected worktree .git file at ${pointer}`);
  }
  const contents = await fs.readFile(pointer, "utf8");
  const name = adminNameFromGitdirFile(contents);
  if (!name) {
    throw new Error(
      `Could not resolve worktree admin name from ${pointer}: ${contents.trim()}`
    );
  }
  return name;
}

async function rewriteWorktreeGitdir(options: {
  workDir: string;
  projectId: string;
  adminName: string;
}): Promise<void> {
  const pointer = path.join(options.workDir, ".git");
  const gitdir = `${canonicalGitContainerPath(options.projectId)}/worktrees/${options.adminName}`;
  await fs.writeFile(pointer, `gitdir: ${gitdir}\n`, "utf8");
}

export type SessionWorktree = {
  workDir: string;
  gitCanonicalHostPath: string;
  projectId: string;
};

/**
 * Ensure a per-session worktree exists for a local project, with the forward
 * .git pointer rewritten to the in-container /forge-git/{projectId} path.
 */
export async function ensureSessionWorktree(options: {
  canonicalKey: string;
  projectId: string;
  sessionId: string;
  branchName: string;
}): Promise<SessionWorktree> {
  const { canonicalKey, projectId, sessionId, branchName } = options;
  await ensureCanonicalGitRepo(canonicalKey);
  await ensureSessionsRoot();

  const workDir = worktreeWorkDir(projectId, sessionId);
  const gitCanonicalHostPath = path.join(canonicalKey, ".git");
  const parent = path.dirname(workDir);
  await fs.mkdir(parent, { recursive: true });

  const alreadyPresent = await pathExists(workDir);
  if (!alreadyPresent) {
    await git(canonicalKey, ["worktree", "add", "-B", branchName, workDir]);
    await configureForgeIdentity(workDir).catch(() => {});
    const adminName = await resolveWorktreeAdminName(workDir);
    await rewriteWorktreeGitdir({ workDir, projectId, adminName });
  } else {
    // Re-apply rewrite only when the pointer still uses a host path.
    const pointer = path.join(workDir, ".git");
    try {
      const contents = await fs.readFile(pointer, "utf8");
      const existing = adminNameFromGitdirFile(contents);
      const containerPrefix = canonicalGitContainerPath(projectId);
      if (existing && !contents.includes(containerPrefix)) {
        await configureForgeIdentity(workDir).catch(() => {});
        await rewriteWorktreeGitdir({
          workDir,
          projectId,
          adminName: existing
        });
      }
      // Already rewritten to /forge-git/... — nothing to do on poll/reprovision.
    } catch {
      /* leave as-is; provision will fail loudly if git is broken */
    }
  }

  return { workDir, gitCanonicalHostPath, projectId };
}

/**
 * Remove a session worktree directory and prune the canonical repo's worktree list.
 * Best-effort: does not throw when already gone.
 */
export async function removeSessionWorktree(options: {
  canonicalKey: string;
  projectId: string;
  sessionId: string;
}): Promise<void> {
  const workDir = worktreeWorkDir(options.projectId, options.sessionId);
  await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  if (await isGitRepo(options.canonicalKey)) {
    await git(options.canonicalKey, ["worktree", "prune"]).catch(() => {});
  }
}

/**
 * Merge a session branch into the canonical default branch on the host.
 * Objects are already in the shared .git after an in-container commit.
 */
export async function mergeSessionBranchIntoCanonical(options: {
  canonicalKey: string;
  branchName: string;
}): Promise<void> {
  const { canonicalKey, branchName } = options;
  await ensureCanonicalGitRepo(canonicalKey);

  let defaultBranch = "main";
  try {
    const { stdout } = await git(canonicalKey, [
      "symbolic-ref",
      "--short",
      "refs/remotes/origin/HEAD"
    ]);
    const m = stdout.trim().match(/origin\/(.+)/);
    if (m?.[1]) defaultBranch = m[1];
  } catch {
    try {
      const { stdout } = await git(canonicalKey, [
        "rev-parse",
        "--abbrev-ref",
        "HEAD"
      ]);
      if (stdout.trim()) defaultBranch = stdout.trim();
    } catch {
      /* keep main */
    }
  }

  await git(canonicalKey, ["checkout", defaultBranch]).catch(async () => {
    await git(canonicalKey, ["checkout", "-B", defaultBranch]);
  });

  try {
    await git(canonicalKey, ["merge", "--ff-only", branchName]);
  } catch {
    await git(canonicalKey, [
      "merge",
      "--no-ff",
      "-m",
      `forge: promote ${branchName}`,
      branchName
    ]);
  }
}
