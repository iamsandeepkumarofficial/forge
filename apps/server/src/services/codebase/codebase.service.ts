import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { assertSafeRepoDirectoryName, parseGithubSlug } from "@forge/core";

const N_10 = 10;
const N_1024 = 1024;

const execFileAsync = promisify(execFile);
const DEFAULT_FORGE_HOME = path.join(os.homedir(), ".forge");
const DEFAULT_MANAGED_ROOT = path.join(DEFAULT_FORGE_HOME, "repositories");
const LEGACY_SESSIONS_IN_REPOS = ".sessions";
function expandHome(raw: string): string {
  if (raw.startsWith("~/")) {
    return path.resolve(os.homedir(), raw.slice(2));
  }
  return raw;
}
export function resolveManagedRoot(): string {
  const raw = process.env.CODEBASE_ROOT?.trim();
  if (!raw) {
    return DEFAULT_MANAGED_ROOT;
  }
  const expanded = expandHome(raw);
  if (path.isAbsolute(expanded)) {
    return expanded;
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "../../../../..");
  return path.resolve(repoRoot, expanded);
}
async function isGitDir(dir: string): Promise<boolean> {
  const gitPath = path.join(dir, ".git");
  try {
    const st = await fs.stat(gitPath);
    return st.isDirectory() || st.isFile();
  } catch {
    return false;
  }
}
async function isMainGitClone(dir: string): Promise<boolean> {
  const gitPath = path.join(dir, ".git");
  try {
    const st = await fs.stat(gitPath);
    return st.isDirectory();
  } catch {
    return false;
  }
}
export async function listMainManagedRepoRoots(
  managedRoot: string
): Promise<string[]> {
  const out: string[] = [];
  let names: string[];
  try {
    names = await fs.readdir(managedRoot);
  } catch {
    return out;
  }
  for (const name of names) {
    if (name.startsWith(".") || name === LEGACY_SESSIONS_IN_REPOS) {
      continue;
    }
    const full = path.join(managedRoot, name);
    let st: Awaited<ReturnType<typeof fs.stat>>;
    try {
      st = await fs.stat(full);
    } catch {
      continue;
    }
    if (!st.isDirectory()) {
      continue;
    }
    if (await isMainGitClone(full)) {
      out.push(path.resolve(full));
    }
  }
  return out.sort();
}
export async function ghRepoCloneIntoManagedRoot(
  slug: string,
  options?: {
    shallow?: boolean;
    managedRoot?: string;
    token?: string;
  }
): Promise<{
  path: string;
  alreadyExisted: boolean;
}> {
  const parsed = parseGithubSlug(slug);
  if (!parsed) {
    throw new Error(
      'Invalid GitHub slug. Use "owner/repo" (GitLab and others later).'
    );
  }
  const { owner, repo } = parsed;
  assertSafeRepoDirectoryName(repo);
  const managedRoot = path.resolve(
    options?.managedRoot ?? resolveManagedRoot()
  );
  const target = path.join(managedRoot, repo);
  if (await isGitDir(target)) {
    return { path: target, alreadyExisted: true };
  }
  try {
    await fs.access(target);
    throw new Error(`Path exists but is not a git repository: ${target}`);
  } catch (e: unknown) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw e instanceof Error ? e : new Error(String(e));
    }
  }
  await fs.mkdir(managedRoot, { recursive: true });
  const args = ["repo", "clone", `${owner}/${repo}`, target];
  if (options?.shallow) {
    args.push("--", "--depth", "1");
  }
  const env = { ...process.env };
  if (options?.token) {
    env.GH_TOKEN = options.token;
    env.GITHUB_TOKEN = options.token;
  }
  try {
    await execFileAsync("gh", args, {
      cwd: managedRoot,
      maxBuffer: N_10 * N_1024 * N_1024,
      env
    });
  } catch (e: unknown) {
    const err = e as {
      stderr?: Buffer;
      stdout?: Buffer;
      message?: string;
    };
    const piece =
      err.stderr?.toString().trim() ||
      err.stdout?.toString().trim() ||
      err.message;
    throw new Error(
      piece
        ? `gh repo clone failed: ${piece}`
        : "gh repo clone failed (is `gh` installed and in PATH?)",
      { cause: e }
    );
  }
  return { path: target, alreadyExisted: false };
}
export async function listManagedRepos(): Promise<{
  managedRoot: string;
  repos: string[];
}> {
  const managedRoot = path.resolve(resolveManagedRoot());
  const roots = await listMainManagedRepoRoots(managedRoot);
  return { managedRoot, repos: roots.map((r) => path.basename(r)) };
}
export async function cloneGithubRepo(
  slug: string,
  options?: {
    shallow?: boolean;
    token?: string;
  }
): Promise<{
  path: string;
  alreadyExisted: boolean;
}> {
  return ghRepoCloneIntoManagedRoot(slug, options);
}
