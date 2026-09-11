import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { CLONE_SKIP_DIR_NAMES } from "./hostWorkspaceFs.js";
import { deleteFileFromSandbox, dockerExec } from "./sandboxExec.js";
import {
  getSessionRepoInfo,
  provisionSessionSandbox
} from "./sessionSandbox.js";
import { WORKSPACE_MOUNT } from "./sessionSandbox/constants.js";

const COPY_CONCURRENCY = 32;
const N_8192 = 8192;
const COPY_COW =
  typeof fsConstants.COPYFILE_FICLONE === "number"
    ? fsConstants.COPYFILE_FICLONE
    : 0;

type CloneEntry =
  | { rel: string; kind: "file"; srcAbs: string }
  | { rel: string; kind: "symlink"; target: string };

function isInsideRoot(absPath: string, root: string): boolean {
  const resolved = path.resolve(absPath);
  const base = path.resolve(root);
  return resolved === base || resolved.startsWith(`${base}${path.sep}`);
}

async function copyFileCow(src: string, dest: string): Promise<void> {
  try {
    await fs.copyFile(src, dest, COPY_COW);
  } catch {
    await fs.copyFile(src, dest);
  }
}

async function replaceDest(dest: string): Promise<void> {
  await fs.rm(dest, { recursive: true, force: true });
}

async function ensureRealDir(
  destFile: string,
  treeRoot: string
): Promise<void> {
  const rel = path.relative(treeRoot, destFile);
  const parts = rel.split(path.sep);
  let cur = treeRoot;
  for (const part of parts.slice(0, -1)) {
    cur = path.join(cur, part);
    let st;
    try {
      st = await fs.lstat(cur);
    } catch {
      await fs.mkdir(cur, { recursive: true });
      continue;
    }
    if (st.isDirectory() && !st.isSymbolicLink()) continue;
    await fs.rm(cur, { recursive: true, force: true });
    await fs.mkdir(cur, { recursive: true });
  }
}

async function runPool(options: {
  count: number;
  limit: number;
  fn: (index: number) => Promise<void>;
}): Promise<void> {
  const { count, limit, fn } = options;
  if (count === 0) return;
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= count) return;
      await fn(i);
    }
  }
  const n = Math.min(limit, count);
  await Promise.all(Array.from({ length: n }, () => worker()));
}

async function listCloneEntries(
  root: string,
  options?: { followOutsideDirs?: boolean }
): Promise<CloneEntry[]> {
  const out: CloneEntry[] = [];
  const treeRoot = await fs.realpath(path.resolve(root));
  const followOutsideDirs = options?.followOutsideDirs === true;

  async function walk(dir: string, rel: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (CLONE_SKIP_DIR_NAMES.has(e.name)) continue;
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      const abs = path.join(dir, e.name);
      if (e.isSymbolicLink()) {
        const st = await fs.stat(abs).catch(() => null);
        const real = await fs.realpath(abs).catch(() => null);
        if (
          followOutsideDirs &&
          st?.isDirectory() &&
          real &&
          !isInsideRoot(real, treeRoot)
        ) {
          await walk(real, childRel);
          continue;
        }
        const target = await fs.readlink(abs);
        out.push({ rel: childRel, kind: "symlink", target });
        continue;
      }
      if (e.isDirectory()) {
        await walk(abs, childRel);
        continue;
      }
      if (e.isFile()) out.push({ rel: childRel, kind: "file", srcAbs: abs });
    }
  }

  await walk(treeRoot, "");
  out.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  return out;
}

export async function syncHostWorkingTree(
  fromRoot: string,
  toRoot: string
): Promise<void> {
  const fromAbs = path.resolve(fromRoot);
  const toAbs = path.resolve(toRoot);
  const fromEntries = await listCloneEntries(fromAbs, {
    followOutsideDirs: true
  });
  const fromSet = new Set(fromEntries.map((e) => e.rel));
  await runPool({
    count: fromEntries.length,
    limit: COPY_CONCURRENCY,
    fn: async (i) => {
      const entry = fromEntries[i]!;
      const dest = path.join(toAbs, entry.rel);
      await ensureRealDir(dest, toAbs);
      await replaceDest(dest);
      if (entry.kind === "symlink") {
        await fs.symlink(entry.target, dest);
        return;
      }
      await copyFileCow(entry.srcAbs, dest);
    }
  });
  const toEntries = await listCloneEntries(toAbs);
  await runPool({
    count: toEntries.length,
    limit: COPY_CONCURRENCY,
    fn: async (i) => {
      const entry = toEntries[i]!;
      if (fromSet.has(entry.rel)) return;
      await fs.rm(path.join(toAbs, entry.rel), { force: true }).catch(() => {});
    }
  });
}

function findPruneArgv(mount: string): string[] {
  const names = [...CLONE_SKIP_DIR_NAMES];
  const prune: string[] = ["("];
  for (let i = 0; i < names.length; i++) {
    if (i > 0) prune.push("-o");
    prune.push("-name", names[i]!);
  }
  prune.push(
    ")",
    "-prune",
    "-o",
    "(",
    "-type",
    "f",
    "-o",
    "-type",
    "l",
    ")",
    "-print"
  );
  return ["find", mount, ...prune];
}

function relFromMount(absPath: string, mount: string): string {
  const prefix = mount.endsWith("/") ? mount : `${mount}/`;
  if (absPath === mount) return "";
  if (absPath.startsWith(prefix)) return absPath.slice(prefix.length);
  return absPath.replace(/^\//, "");
}

async function listSandboxRelFiles(options: {
  sessionId: string;
  container: string;
  mount: string;
}): Promise<string[]> {
  const r = await dockerExec({
    container: options.container,
    sessionId: options.sessionId,
    argv: findPruneArgv(options.mount)
  });
  if (r.code !== 0) {
    throw new Error(
      r.stderr.trim() || `failed to list files under ${options.mount}`
    );
  }
  return r.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((abs) => relFromMount(abs, options.mount))
    .filter(Boolean)
    .sort();
}

function cappedErr(prev: string, chunk: Buffer): string {
  const next = prev + chunk.toString();
  return next.length > N_8192 ? next.slice(-N_8192) : next;
}

function spawnDocker(args: string[]) {
  return spawn("docker", args, { env: process.env });
}

function dockerTarClone(options: {
  sourceContainer: string;
  sourceMount: string;
  targetContainer: string;
  targetMount: string;
}): Promise<void> {
  const excludes = [...CLONE_SKIP_DIR_NAMES].flatMap((name) => [
    "--exclude",
    name
  ]);
  return new Promise((resolve, reject) => {
    const src = spawnDocker([
      "exec",
      options.sourceContainer,
      "tar",
      "-C",
      options.sourceMount,
      ...excludes,
      "-cf",
      "-",
      "."
    ]);
    const dst = spawnDocker([
      "exec",
      "-i",
      options.targetContainer,
      "tar",
      "-C",
      options.targetMount,
      "-xf",
      "-"
    ]);
    src.stdout.pipe(dst.stdin);
    dst.stdin.on("error", () => {});
    let srcErr = "";
    let dstErr = "";
    src.stderr.on("data", (c: Buffer) => {
      srcErr = cappedErr(srcErr, c);
    });
    dst.stderr.on("data", (c: Buffer) => {
      dstErr = cappedErr(dstErr, c);
    });
    const fail = (err: Error) => {
      src.kill();
      dst.kill();
      reject(err);
    };
    src.on("error", fail);
    dst.on("error", fail);
    let srcCode: number | null = null;
    let dstCode: number | null = null;
    const finish = () => {
      if (srcCode === null || dstCode === null) return;
      if (srcCode !== 0) {
        reject(new Error(srcErr.trim() || `source tar exited ${srcCode}`));
        return;
      }
      if (dstCode !== 0) {
        reject(new Error(dstErr.trim() || `dest tar exited ${dstCode}`));
        return;
      }
      resolve();
    };
    src.on("close", (code) => {
      srcCode = code ?? 1;
      if (srcCode !== 0) dst.kill();
      finish();
    });
    dst.on("close", (code) => {
      dstCode = code ?? 1;
      finish();
    });
  });
}

async function syncSandboxWorkingTree(options: {
  sourceSessionId: string;
  sourceContainer: string;
  sourceMount: string;
  targetSessionId: string;
  targetContainer: string;
  targetMount: string;
}): Promise<void> {
  const fromFiles = await listSandboxRelFiles({
    sessionId: options.sourceSessionId,
    container: options.sourceContainer,
    mount: options.sourceMount
  });
  await dockerTarClone({
    sourceContainer: options.sourceContainer,
    sourceMount: options.sourceMount,
    targetContainer: options.targetContainer,
    targetMount: options.targetMount
  });
  const toFiles = await listSandboxRelFiles({
    sessionId: options.targetSessionId,
    container: options.targetContainer,
    mount: options.targetMount
  });
  const fromSet = new Set(fromFiles);
  for (const rel of toFiles) {
    if (fromSet.has(rel)) continue;
    await deleteFileFromSandbox({
      container: options.targetContainer,
      sessionId: options.targetSessionId,
      absPath: `${options.targetMount}/${rel}`
    });
  }
}

function memberNames(
  worktrees: Record<string, string> | undefined,
  fallback: string
): string[] {
  const keys = worktrees ? Object.keys(worktrees) : [];
  return keys.length > 0 ? keys.sort() : [fallback];
}

function memberMount(
  worktrees: Record<string, string> | undefined,
  repo: string
): string {
  return worktrees?.[repo] ?? `${WORKSPACE_MOUNT}/${repo}`;
}

export async function cloneSessionWorkingTree(options: {
  sourceSessionId: string;
  targetSessionId: string;
}): Promise<void> {
  await provisionSessionSandbox(options.sourceSessionId);
  await provisionSessionSandbox(options.targetSessionId);
  const src = await getSessionRepoInfo(options.sourceSessionId);
  const dst = await getSessionRepoInfo(options.targetSessionId);
  const repos = [
    ...new Set([
      ...memberNames(src.worktrees, src.repoDir),
      ...memberNames(dst.worktrees, dst.repoDir)
    ])
  ].sort();
  for (const repo of repos) {
    const fromHost = src.hostWorktrees?.[repo];
    const toHost = dst.hostWorktrees?.[repo];
    if (fromHost && toHost) {
      await syncHostWorkingTree(fromHost, toHost);
      continue;
    }
    await syncSandboxWorkingTree({
      sourceSessionId: options.sourceSessionId,
      sourceContainer: src.containerName,
      sourceMount: memberMount(src.worktrees, repo),
      targetSessionId: options.targetSessionId,
      targetContainer: dst.containerName,
      targetMount: memberMount(dst.worktrees, repo)
    });
  }
}
