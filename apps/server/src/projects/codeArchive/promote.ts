import { dockerExec } from "../sandboxExec.js";
import { parseGithubSlug } from "@forge/core";
import type { Project } from "@forge/db";
import { mergeSessionBranchIntoCanonical } from "../localWorktree.js";

const EXCLUDES = [
  "--exclude=./.git",
  "--exclude=*/.git",
  "--exclude=./node_modules",
  "--exclude=*/node_modules"
];

export async function promoteGithubBranch(options: {
  containerName: string;
  sessionId: string;
  workingDir: string;
  project: Project;
  branch: string;
}): Promise<{ target: "github"; branch: string }> {
  if (!parseGithubSlug(options.project.dedupeKey)) {
    throw new Error(`Invalid GitHub slug: ${options.project.dedupeKey}`);
  }
  const r = await dockerExec({
    container: options.containerName,
    sessionId: options.sessionId,
    argv: [
      "sh",
      "-c",
      'cd "$WD" && git config user.email "forge@local" && git config user.name "Forge Agent" && ' +
        'git add -A && (git commit -q -m "forge: promote working changes" || true) && ' +
        'git push origin "HEAD:$BRANCH"'
    ],
    env: { WD: options.workingDir, BRANCH: options.branch }
  });
  if (r.code !== 0) {
    throw new Error(r.stderr.trim() || "git push failed");
  }
  return { target: "github", branch: options.branch };
}

export async function promoteLocalBranch(options: {
  containerName: string;
  sessionId: string;
  workingDir: string;
  project: Project;
  branch: string;
}): Promise<{ target: "local"; branch: string }> {
  if (!options.project.canonicalKey) {
    throw new Error("Local project is missing canonicalKey");
  }
  const r = await dockerExec({
    container: options.containerName,
    sessionId: options.sessionId,
    argv: [
      "sh",
      "-c",
      'cd "$WD" && git config user.email "forge@local" && git config user.name "Forge Agent" && ' +
        'git add -A && (git commit -q -m "forge: promote working changes" || true)'
    ],
    env: { WD: options.workingDir }
  });
  if (r.code !== 0) {
    throw new Error(r.stderr.trim() || "git commit in session worktree failed");
  }
  await mergeSessionBranchIntoCanonical({
    canonicalKey: options.project.canonicalKey,
    branchName: options.branch
  });
  return { target: "local", branch: options.branch };
}

export { EXCLUDES };
