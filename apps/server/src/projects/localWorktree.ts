import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import {
  ensureSessionsRoot,
  sessionWorktreeDir
} from "../services/project/projectsRoot.js";

const execFileAsync = promisify(execFile);

export const FORGE_GIT_IDENTITY = {
  name: "Forge Agent",
  email: "forge@local"
} as const;

const DOCKER_NAME_MAX = 48;
const N_10 = 10;
const N_25 = 25;
const N_5000 = 5_000;
const N_1024 = 1024;

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

async function gitConfigSet(options: {
  repoDir: string;
  key: string;
  value: string;
}): Promise<void> {
  const { repoDir, key, value } = options;
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await git(repoDir, ["config", key, value]);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const locked = /could not lock config file|\.lock/i.test(msg);
      if (!locked || attempt === maxAttempts - 1) {
        const current = await gitConfigGet(repoDir, key);
        if (current === value) return;
        throw err;
      }
      const lockPath = path.join(repoDir, ".git", "config.lock");
      try {
        const st = await fs.stat(lockPath);

        if (Date.now() - st.mtimeMs > N_5000) {
          await fs.rm(lockPath, { force: true });
        }
      } catch {
        void 0;
      }
      await new Promise((r) => setTimeout(r, N_25 * (attempt + 1)));
    }
  }
}

async function configureForgeIdentity(repoDir: string): Promise<void> {
  const email = await gitConfigGet(repoDir, "user.email");
  if (email !== FORGE_GIT_IDENTITY.email) {
    await gitConfigSet({
      repoDir,
      key: "user.email",
      value: FORGE_GIT_IDENTITY.email
    });
  }
  const name = await gitConfigGet(repoDir, "user.name");
  if (name !== FORGE_GIT_IDENTITY.name) {
    await gitConfigSet({
      repoDir,
      key: "user.name",
      value: FORGE_GIT_IDENTITY.name
    });
  }
  const fileMode = await gitConfigGet(repoDir, "core.fileMode");
  if (fileMode !== "false") {
    await gitConfigSet({
      repoDir,
      key: "core.fileMode",
      value: "false"
    }).catch(() => {});
  }
}

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

export async function ensureSessionWorktree(options: {
  canonicalKey: string;
  projectId: string;
  sessionId: string;
  branchName: string;

  workDir?: string;

  rewriteContainerGitdir?: boolean;
}): Promise<SessionWorktree> {
  const { canonicalKey, projectId, sessionId, branchName } = options;
  await ensureCanonicalGitRepo(canonicalKey);
  await ensureSessionsRoot();

  const workDir = options.workDir ?? worktreeWorkDir(projectId, sessionId);
  const rewriteContainer = options.rewriteContainerGitdir !== false;
  const gitCanonicalHostPath = path.join(canonicalKey, ".git");
  const parent = path.dirname(workDir);
  await fs.mkdir(parent, { recursive: true });

  const alreadyPresent = await pathExists(workDir);
  if (!alreadyPresent) {
    try {
      await git(canonicalKey, ["worktree", "add", "-B", branchName, workDir]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const concurrent =
        /already used by worktree at/i.test(msg) && msg.includes(workDir);
      if (!concurrent && !(await pathExists(workDir))) {
        throw err;
      }
    }
    if (await pathExists(workDir)) {
      await configureForgeIdentity(workDir).catch(() => {});
      if (rewriteContainer) {
        const adminName = await resolveWorktreeAdminName(workDir);
        await rewriteWorktreeGitdir({ workDir, projectId, adminName });
      }
    }
  } else if (rewriteContainer) {
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
    } catch {
      void 0;
    }
  }

  return { workDir, gitCanonicalHostPath, projectId };
}

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

export function taskWorktreeDir(
  sessionWorkDir: string,
  taskId: string
): string {
  const safe = taskId
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(0, DOCKER_NAME_MAX);
  return path.join(sessionWorkDir, ".forge-tasks", safe || "task");
}

export async function ensureTaskWorktree(options: {
  sessionWorkDir: string;
  taskId: string;
  branchName?: string;
}): Promise<{ worktreePath: string }> {
  const worktreePath = taskWorktreeDir(options.sessionWorkDir, options.taskId);
  await fs.mkdir(path.dirname(worktreePath), { recursive: true });
  if (await pathExists(worktreePath)) {
    return { worktreePath };
  }
  if (!(await isGitRepo(options.sessionWorkDir))) {
    await fs.mkdir(worktreePath, { recursive: true });
    return { worktreePath };
  }
  const branch =
    options.branchName ??
    `forge-task/${options.taskId.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  try {
    await git(options.sessionWorkDir, [
      "worktree",
      "add",
      "-B",
      branch,
      worktreePath
    ]);
  } catch (err) {
    if (!(await pathExists(worktreePath))) throw err;
  }
  return { worktreePath };
}

export type MergeTaskWorktreeResult =
  | { ok: true }
  | {
      ok: false;
      conflict: true;
      paths: string[];
      message: string;
    };

export async function mergeTaskWorktree(options: {
  sessionWorkDir: string;
  taskWorktreePath: string;
}): Promise<MergeTaskWorktreeResult> {
  const { sessionWorkDir, taskWorktreePath } = options;
  if (!(await isGitRepo(sessionWorkDir))) {
    return { ok: true };
  }
  if (!(await pathExists(taskWorktreePath))) {
    return { ok: true };
  }
  try {
    await git(taskWorktreePath, ["add", "-A"]);
    await git(taskWorktreePath, [
      "commit",
      "--allow-empty",
      "-m",
      "forge: task worktree checkpoint"
    ]).catch(() => {});
    const { stdout: head } = await git(taskWorktreePath, ["rev-parse", "HEAD"]);
    const sha = head.trim();
    try {
      await git(sessionWorkDir, ["merge", "--no-ff", "--no-edit", sha]);
      return { ok: true };
    } catch (err) {
      await git(sessionWorkDir, ["merge", "--abort"]).catch(() => {});
      let paths: string[] = [];
      try {
        const { stdout } = await git(sessionWorkDir, [
          "diff",
          "--name-only",
          "--diff-filter=U"
        ]);
        paths = stdout
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
      } catch {
        paths = [];
      }
      return {
        ok: false,
        conflict: true,
        paths,
        message: err instanceof Error ? err.message : String(err)
      };
    }
  } catch (err) {
    await git(sessionWorkDir, ["merge", "--abort"]).catch(() => {});
    return {
      ok: false,
      conflict: true,
      paths: [],
      message: err instanceof Error ? err.message : String(err)
    };
  }
}
