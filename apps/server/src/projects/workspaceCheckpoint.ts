import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ChatTurnRepository } from "../catalog/sessionChatRepository.js";
import { FORGE_GIT_IDENTITY } from "./localWorktree.js";
import { dockerExec, type ExecResult } from "./sandboxExec.js";
import {
  provisionSessionSandbox,
  getSessionRepoInfo
} from "./sessionSandbox.js";

const execFileAsync = promisify(execFile);

const SHA_RE = /^[0-9a-f]{40}([0-9a-f]{24})?$/i;
const TURN_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type GitExecResult = { code: number; stdout: string; stderr: string };

export type GitRunner = (
  args: string[],
  options?: { env?: Record<string, string> }
) => Promise<GitExecResult>;

export const FORGE_CHECKPOINT_REF_PREFIX = "refs/forge/checkpoints/";

const CHECKPOINT_ENV: Record<string, string> = {
  GIT_AUTHOR_NAME: FORGE_GIT_IDENTITY.name,
  GIT_AUTHOR_EMAIL: FORGE_GIT_IDENTITY.email,
  GIT_COMMITTER_NAME: FORGE_GIT_IDENTITY.name,
  GIT_COMMITTER_EMAIL: FORGE_GIT_IDENTITY.email
};

export function checkpointRefForTurn(turnId: string): string {
  return `${FORGE_CHECKPOINT_REF_PREFIX}${turnId}`;
}

export function parseWorkspaceCheckpoint(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key.trim() || typeof value !== "string") continue;
    const sha = value.trim();
    if (!SHA_RE.test(sha)) continue;
    out[key] = sha;
  }
  return out;
}

function gitFailed(result: GitExecResult, label: string): Error {
  const detail = (result.stderr || result.stdout).trim();
  return new Error(
    `${label} failed (${result.code})${detail ? `: ${detail}` : ""}`
  );
}

export async function checkpointGitRepo(options: {
  git: GitRunner;
  turnId: string;
}): Promise<string | null> {
  const { git, turnId } = options;
  if (!TURN_ID_RE.test(turnId)) {
    throw new Error(`Unsafe checkpoint turn id: ${turnId}`);
  }
  const inside = await git(["rev-parse", "--is-inside-work-tree"]);
  if (inside.code !== 0 || inside.stdout.trim() !== "true") return null;
  const head = await git(["rev-parse", "HEAD"]);
  if (head.code !== 0) return null;
  const add = await git(["add", "-A"]);
  if (add.code !== 0) throw gitFailed(add, "git add -A");
  const tree = await git(["write-tree"]);
  if (tree.code !== 0) throw gitFailed(tree, "git write-tree");
  const treeSha = tree.stdout.trim();
  const commit = await git(
    ["commit-tree", treeSha, "-p", "HEAD", "-m", `forge-checkpoint ${turnId}`],
    { env: CHECKPOINT_ENV }
  );
  if (commit.code !== 0) throw gitFailed(commit, "git commit-tree");
  const sha = commit.stdout.trim();
  if (!SHA_RE.test(sha)) {
    throw new Error(`git commit-tree returned an invalid sha: ${sha}`);
  }
  const upd = await git(["update-ref", checkpointRefForTurn(turnId), sha]);
  if (upd.code !== 0) throw gitFailed(upd, "git update-ref");
  const reset = await git(["reset", "HEAD"]);
  if (reset.code !== 0) throw gitFailed(reset, "git reset HEAD");
  return sha;
}

export async function restoreGitRepo(options: {
  git: GitRunner;
  sha: string;
}): Promise<void> {
  const { git, sha } = options;
  if (!SHA_RE.test(sha)) {
    throw new Error(`Invalid checkpoint sha: ${sha}`);
  }
  const reset = await git(["reset", "--hard", sha]);
  if (reset.code !== 0) throw gitFailed(reset, "git reset --hard");
  const clean = await git(["clean", "-fd"]);
  if (clean.code !== 0) throw gitFailed(clean, "git clean -fd");
}

export function createLocalGitRunner(cwd: string): GitRunner {
  return async (args, options) => {
    try {
      const { stdout, stderr } = await execFileAsync(
        "git",
        ["-C", cwd, ...args],
        {
          env: { ...process.env, ...(options?.env ?? {}) },
          encoding: "utf8"
        }
      );
      return { code: 0, stdout: String(stdout), stderr: String(stderr) };
    } catch (err) {
      const e = err as {
        code?: number | string;
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      return {
        code: typeof e.code === "number" ? e.code : 1,
        stdout: e.stdout ?? "",
        stderr: e.stderr ?? e.message ?? String(err)
      };
    }
  };
}

function createSandboxGitRunner(options: {
  sessionId: string;
  containerName: string;
  cwd: string;
}): GitRunner {
  const { sessionId, containerName, cwd } = options;
  return async (args, extra) => {
    const result: ExecResult = await dockerExec({
      container: containerName,
      sessionId,
      cwd,
      argv: ["git", ...args],
      env: extra?.env
    });
    return result;
  };
}

function memberWorktrees(options: {
  worktrees: Record<string, string> | undefined;
  repoDir: string;
  workingDir: string;
}): Record<string, string> {
  const { worktrees, repoDir, workingDir } = options;
  if (worktrees && Object.keys(worktrees).length > 0) return worktrees;
  return { [repoDir]: `${workingDir}/${repoDir}` };
}

export async function checkpointSessionWorkspace(options: {
  sessionId: string;
  turnId: string;
}): Promise<Record<string, string>> {
  const { sessionId, turnId } = options;
  const turns = new ChatTurnRepository();
  const existing = await turns.getById(turnId);
  const already = parseWorkspaceCheckpoint(existing?.workspaceCheckpoint);
  if (Object.keys(already).length > 0) return already;
  await provisionSessionSandbox(sessionId);
  const info = await getSessionRepoInfo(sessionId);
  const worktrees = memberWorktrees({
    worktrees: info.worktrees,
    repoDir: info.repoDir,
    workingDir: info.workingDir
  });
  const checkpoint: Record<string, string> = {};
  for (const [repoName, cwd] of Object.entries(worktrees)) {
    const git = createSandboxGitRunner({
      sessionId,
      containerName: info.containerName,
      cwd
    });
    const sha = await checkpointGitRepo({ git, turnId });
    if (sha) checkpoint[repoName] = sha;
  }
  await turns.setWorkspaceCheckpoint(turnId, checkpoint);
  return checkpoint;
}

export async function restoreSessionWorkspace(options: {
  sessionId: string;
  checkpoint: Record<string, string>;
}): Promise<{ restored: string[]; skipped: string[] }> {
  const { sessionId, checkpoint } = options;
  await provisionSessionSandbox(sessionId);
  const info = await getSessionRepoInfo(sessionId);
  const worktrees = memberWorktrees({
    worktrees: info.worktrees,
    repoDir: info.repoDir,
    workingDir: info.workingDir
  });
  const restored: string[] = [];
  const skipped: string[] = [];
  for (const [repoName, sha] of Object.entries(checkpoint)) {
    const cwd = worktrees[repoName];
    if (!cwd) {
      skipped.push(repoName);
      continue;
    }
    const git = createSandboxGitRunner({
      sessionId,
      containerName: info.containerName,
      cwd
    });
    const inside = await git(["rev-parse", "--is-inside-work-tree"]);
    if (inside.code !== 0 || inside.stdout.trim() !== "true") {
      skipped.push(repoName);
      continue;
    }
    await restoreGitRepo({ git, sha });
    restored.push(repoName);
  }
  return { restored, skipped };
}

export async function restoreSessionWorkspaceFromTurn(options: {
  sessionId: string;
  turnId: string | null;
}): Promise<{ workspaceRestored: boolean }> {
  const { sessionId, turnId } = options;
  if (!turnId) return { workspaceRestored: false };
  const turns = new ChatTurnRepository();
  const turn = await turns.getById(turnId);
  const checkpoint = parseWorkspaceCheckpoint(turn?.workspaceCheckpoint);
  if (Object.keys(checkpoint).length === 0) {
    return { workspaceRestored: false };
  }
  const { restored } = await restoreSessionWorkspace({
    sessionId,
    checkpoint
  });
  return { workspaceRestored: restored.length > 0 };
}
