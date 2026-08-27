import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { assertSafeRepoDirectoryName, parseGithubSlug } from "@forge/core";
import type { Project } from "@forge/db";
import { docker } from "./container.js";
import { WORKSPACE_MOUNT } from "./constants.js";

const execFileAsync = promisify(execFile);

export type LocalFolderSource = {
  type: "local_folder";
  path: string;
};

export function repoDirForProject(project: Project): string {
  if (project.source === "github") {
    const parsed = parseGithubSlug(project.dedupeKey);
    const repo =
      parsed?.repo || project.dedupeKey.split("/").pop() || project.dedupeKey;
    assertSafeRepoDirectoryName(repo);
    return repo;
  }
  return "repo";
}

export function assertSafeBranch(branch: string): void {
  if (!branch || branch.includes("..") || !/^[A-Za-z0-9._/-]+$/.test(branch)) {
    throw new Error(`Unsafe branch name: ${branch}`);
  }
}

export async function assertLocalFolderPath(folderPath: string): Promise<string> {
  if (!folderPath || typeof folderPath !== "string" || !folderPath.trim()) {
    throw new Error("Local folder path is required");
  }
  const trimmed = folderPath.trim();
  if (!path.isAbsolute(trimmed)) {
    throw new Error(`Local folder path must be absolute: ${trimmed}`);
  }
  let st: Awaited<ReturnType<typeof fs.stat>>;
  try {
    st = await fs.stat(trimmed);
  } catch {
    throw new Error(`Local folder path does not exist: ${trimmed}`);
  }
  if (!st.isDirectory()) {
    throw new Error(`Local folder path is not a directory: ${trimmed}`);
  }
  return trimmed;
}

export async function isRepoInitialized(
  containerName: string
): Promise<boolean> {
  return isRepoInitializedAt(containerName, WORKSPACE_MOUNT);
}

export function cloneGithubWorkspaceScript(): string {
  return [
    "set -e",
    "rm -rf /tmp/forge-src",
    'git clone "$REPO_URL" /tmp/forge-src',
    `cp -a /tmp/forge-src/. "${WORKSPACE_MOUNT}/"`,
    "rm -rf /tmp/forge-src",
    `cd "${WORKSPACE_MOUNT}"`,
    'git checkout -B "$BRANCH"'
  ].join("; ");
}

/** Clone into /workspace/{repoName} for multi-repo workspace sessions. */
export function cloneGithubIntoSubdirScript(repoName: string): string {
  assertSafeRepoDirectoryName(repoName);
  const target = `${WORKSPACE_MOUNT}/${repoName}`;
  return [
    "set -e",
    `mkdir -p "${WORKSPACE_MOUNT}"`,
    `rm -rf "${target}"`,
    "rm -rf /tmp/forge-src",
    'git clone "$REPO_URL" /tmp/forge-src',
    `mkdir -p "${target}"`,
    `cp -a /tmp/forge-src/. "${target}/"`,
    "rm -rf /tmp/forge-src",
    `cd "${target}"`,
    'git checkout -B "$BRANCH"'
  ].join("; ");
}

export async function isRepoInitializedAt(
  containerName: string,
  mountPath: string
): Promise<boolean> {
  try {
    // Accept both a real .git directory and a worktree .git file (RFC 0005).
    await execFileAsync("docker", [
      "exec",
      containerName,
      "sh",
      "-c",
      `git -C "${mountPath}" rev-parse --is-inside-work-tree >/dev/null 2>&1`
    ]);
    return true;
  } catch {
    return false;
  }
}

function githubCloneUrl(project: Project, token?: string): string {
  const parsed = parseGithubSlug(project.dedupeKey);
  if (!parsed) {
    throw new Error(`Invalid GitHub slug for project: ${project.dedupeKey}`);
  }
  const auth = token?.trim() ? `x-access-token:${token.trim()}@` : "";
  return `https://${auth}github.com/${parsed.owner}/${parsed.repo}.git`;
}

export async function cloneGithubIntoVolume(options: {
  containerName: string;
  project: Project;
  branch: string;
  token?: string;
  /** When set, clone into /workspace/{repoName} instead of /workspace. */
  repoName?: string;
}): Promise<void> {
  const { containerName, project, branch, token, repoName } = options;
  const url = githubCloneUrl(project, token);
  const script = repoName
    ? cloneGithubIntoSubdirScript(repoName)
    : cloneGithubWorkspaceScript();
  await docker([
    "exec",
    "-e",
    `REPO_URL=${url}`,
    "-e",
    `BRANCH=${branch}`,
    containerName,
    "sh",
    "-c",
    script
  ]);
}

export async function copyLocalFolderIntoVolume(options: {
  containerName: string;
  hostPath: string;
}): Promise<void> {
  const hostPath = await assertLocalFolderPath(options.hostPath);
  await docker([
    "exec",
    options.containerName,
    "sh",
    "-c",
    `mkdir -p "${WORKSPACE_MOUNT}"`
  ]);
  await docker([
    "cp",
    `${hostPath}/.`,
    `${options.containerName}:${WORKSPACE_MOUNT}`
  ]);
}
