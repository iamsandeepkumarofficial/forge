import fs from "node:fs/promises";
import path from "node:path";
import type { SessionRepoInfo } from "./sessionSandbox.js";
import { WORKSPACE_MOUNT } from "./sessionSandbox/constants.js";

const N_2000000 = 2000000;
const N_200 = 200;

export function hostFsAllowlistRoots(info: SessionRepoInfo): string[] {
  if (info.hostWorktrees && Object.keys(info.hostWorktrees).length > 0) {
    return [
      ...new Set(Object.values(info.hostWorktrees).map((r) => path.resolve(r)))
    ];
  }
  const root = info.hostWorkingDir ?? info.containerName;
  return [path.resolve(root)];
}

export function assertUnderAllowlist(absPath: string, roots: string[]): void {
  const resolved = path.resolve(absPath);
  for (const root of roots) {
    const r = path.resolve(root);
    if (resolved === r || resolved.startsWith(`${r}${path.sep}`)) {
      return;
    }
  }
  throw new Error(
    "Invalid path: outside the session workspace allowlist is not allowed"
  );
}

export function resolveHostFsPath(options: {
  info: SessionRepoInfo;
  logicalAbsPath: string;
}): string {
  const logical = options.logicalAbsPath.replace(/\\/g, "/");
  const stripped =
    logical === WORKSPACE_MOUNT || logical.startsWith(`${WORKSPACE_MOUNT}/`)
      ? logical.slice(WORKSPACE_MOUNT.length).replace(/^\//, "")
      : logical.replace(/^\/+/, "");
  const segments = stripped.split("/").filter((s) => s && s !== ".");
  for (const seg of segments) {
    if (seg === "..") {
      throw new Error(
        "Invalid path: traversal outside the workspace is not allowed"
      );
    }
  }
  const trees = options.info.hostWorktrees;
  if (trees && Object.keys(trees).length > 0 && segments.length > 0) {
    const repo = segments[0]!;
    const repoRoot = trees[repo];
    if (!repoRoot) {
      throw new Error(
        `Invalid path: first segment must be a member repo (${Object.keys(trees).sort().join(", ")}), got "${repo}"`
      );
    }
    const abs = path.resolve(repoRoot, ...segments.slice(1));
    assertUnderAllowlist(abs, hostFsAllowlistRoots(options.info));
    return abs;
  }
  const root = options.info.hostWorkingDir ?? options.info.containerName;
  const abs = path.resolve(root, ...segments);
  assertUnderAllowlist(abs, hostFsAllowlistRoots(options.info));
  return abs;
}

export async function readHostWorkspaceFile(
  absPath: string,
  roots: string[]
): Promise<string | null> {
  assertUnderAllowlist(absPath, roots);
  try {
    return await fs.readFile(absPath, "utf8");
  } catch {
    return null;
  }
}

export async function writeHostWorkspaceFile(options: {
  absPath: string;
  content: string;
  roots: string[];
}): Promise<void> {
  assertUnderAllowlist(options.absPath, options.roots);
  await fs.mkdir(path.dirname(options.absPath), { recursive: true });
  await fs.writeFile(options.absPath, options.content, "utf8");
}

export async function listHostWorkspaceFiles(
  root: string,
  roots: string[]
): Promise<string[]> {
  assertUnderAllowlist(root, roots);
  const out: string[] = [];
  async function walk(dir: string, rel: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === ".git" || e.name === "node_modules") continue;
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(abs, childRel);
        continue;
      }
      if (e.isFile()) out.push(childRel);
    }
  }
  await walk(root, "");
  return out.sort();
}

export type HostDirEntry = { name: string; path: string; isDir: boolean };

export async function listHostWorkspaceDir(options: {
  absPath: string;
  relPrefix: string;
  roots: string[];
}): Promise<HostDirEntry[]> {
  assertUnderAllowlist(options.absPath, options.roots);
  let entries;
  try {
    entries = await fs.readdir(options.absPath, { withFileTypes: true });
  } catch {
    return [];
  }
  const mapped = entries
    .filter((e) => e.name !== ".git" && e.name !== "node_modules")
    .map((e) => {
      const childPath = options.relPrefix
        ? `${options.relPrefix}/${e.name}`
        : e.name;
      return { name: e.name, path: childPath, isDir: e.isDirectory() };
    })
    .sort((a, b) =>
      a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1
    );
  return mapped;
}

export async function searchHostWorkspace(options: {
  baseRoot: string;
  searchRoot: string;
  pattern: string;
  roots: string[];
  maxHits?: number;
}): Promise<string[]> {
  assertUnderAllowlist(options.baseRoot, options.roots);
  assertUnderAllowlist(options.searchRoot, options.roots);
  let regex: RegExp;
  try {
    regex = new RegExp(options.pattern);
  } catch (err) {
    throw new Error(
      `Invalid RegExp: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  const maxHits = options.maxHits ?? N_200;
  const hits: string[] = [];
  async function walk(dir: string): Promise<void> {
    if (hits.length >= maxHits) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (hits.length >= maxHits) return;
      if (e.name === ".git" || e.name === "node_modules") continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(abs);
        continue;
      }
      if (!e.isFile()) continue;
      let st;
      try {
        st = await fs.stat(abs);
      } catch {
        continue;
      }
      if (st.size > N_2000000) continue;
      let buf: Buffer;
      try {
        buf = await fs.readFile(abs);
      } catch {
        continue;
      }
      if (buf.includes(0)) continue;
      const rel = path
        .relative(options.baseRoot, abs)
        .split(path.sep)
        .join("/");
      const lines = buf.toString("utf8").split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (hits.length >= maxHits) return;
        regex.lastIndex = 0;
        if (regex.test(lines[i]!)) {
          hits.push(`${rel}:${i + 1}:${lines[i]}`);
        }
      }
    }
  }
  await walk(options.searchRoot);
  return hits;
}
