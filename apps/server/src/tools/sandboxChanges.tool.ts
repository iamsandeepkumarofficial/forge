import { resolveSandbox, dockerExec } from "../projects/sandboxExec.js";
import {
  parsePorcelain,
  type SessionRepoChanges
} from "../utilities/diff/diff.service.js";

const MAX_DIFF_BYTES = 512000;

export async function collectSandboxChanges(
  sessionId: string
): Promise<SessionRepoChanges[]> {
  const { containerName, repoDir, workingDir, worktrees } =
    await resolveSandbox(sessionId);
  const trees =
    worktrees && Object.keys(worktrees).length > 0
      ? worktrees
      : { [repoDir]: workingDir };
  const out: SessionRepoChanges[] = [];
  for (const [repo, path] of Object.entries(trees)) {
    const r = await dockerExec({
      container: containerName,
      sessionId,
      argv: ["git", "-C", path, "status", "--porcelain=v1", "-uall"]
    });
    if (r.code !== 0) {
      out.push({
        repo,
        worktreePath: path,
        files: [],
        error: r.stderr.trim()
      });
      continue;
    }
    out.push({
      repo,
      worktreePath: path,
      files: parsePorcelain(r.stdout)
    });
  }
  return out;
}

export async function diffFileInSandbox(options: {
  sessionId: string;
  repo: string;
  relPath: string;
}): Promise<string> {
  const { sessionId, repo, relPath } = options;
  const { containerName, repoDir, workingDir, worktrees } =
    await resolveSandbox(sessionId);
  const trees =
    worktrees && Object.keys(worktrees).length > 0
      ? worktrees
      : { [repoDir]: workingDir };
  const mount = trees[repo];
  if (!mount) {
    throw new Error(`unknown repo: ${repo}`);
  }
  const safeRel = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!safeRel || safeRel.includes("..")) {
    throw new Error("Invalid path");
  }
  let out = await dockerExec({
    container: containerName,
    sessionId,
    argv: ["git", "-C", mount, "diff", "HEAD", "--", safeRel]
  });
  let stdout = out.stdout;
  if (!stdout) {
    out = await dockerExec({
      container: containerName,
      sessionId,
      argv: [
        "git",
        "-C",
        mount,
        "diff",
        "--no-index",
        "--",
        "/dev/null",
        safeRel
      ]
    });
    stdout = out.stdout;
  }
  if (Buffer.byteLength(stdout, "utf8") > MAX_DIFF_BYTES) {
    return `${stdout.slice(0, MAX_DIFF_BYTES)}\n\n… (diff truncated)`;
  }
  return stdout || "(no diff — file matches HEAD)";
}
