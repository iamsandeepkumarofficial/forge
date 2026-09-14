import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ChatTurnRepository } from "../catalog/sessionChatRepository.js";
import { resolveSessionsRoot } from "../services/project/projectsRoot.js";
import { sanitizeSessionFsName } from "./sandboxRuntime/hostSessionPaths.js";
import {
  deleteFileFromSandbox,
  resolveSandbox,
  resolveWorkspacePath,
  writeFileToSandbox
} from "./sandboxExec.js";
import {
  assertUnderAllowlist,
  hostFsAllowlistRoots,
  resolveHostFsPath,
  writeHostWorkspaceFile
} from "./hostWorkspaceFs.js";
import type { SessionRepoInfo } from "./sessionSandbox.js";
import type { TouchedFile } from "../tools/fileBatch.js";

const TURN_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/i;

export type WorkspaceCheckpointFile = {
  path: string;
  op: "create" | "update" | "delete";
  blob: string | null;
};

export type WorkspaceCheckpointV1 = {
  version: 1;
  files: WorkspaceCheckpointFile[];
};

export type RestoreEntry = { path: string; before: string | null };

export function parseTouchedFileCheckpoint(
  raw: unknown
): WorkspaceCheckpointV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  if (rec.version !== 1 || !Array.isArray(rec.files)) return null;
  const files: WorkspaceCheckpointFile[] = [];
  for (const item of rec.files) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const filePath = typeof row.path === "string" ? row.path.trim() : "";
    const op = row.op;
    if (!filePath) continue;
    if (op !== "create" && op !== "update" && op !== "delete") continue;
    const blob =
      row.blob === null
        ? null
        : typeof row.blob === "string" && SHA256_RE.test(row.blob)
          ? row.blob
          : null;
    if (row.blob != null && blob === null) continue;
    files.push({ path: filePath, op, blob });
  }
  return { version: 1, files };
}

export function sessionCheckpointDir(
  sessionId: string,
  turnId: string
): string {
  if (!TURN_ID_RE.test(turnId)) {
    throw new Error(`Unsafe checkpoint turn id: ${turnId}`);
  }
  return path.join(
    resolveSessionsRoot(),
    "_checkpoints",
    sanitizeSessionFsName(sessionId),
    turnId
  );
}

function blobPath(dir: string, sha: string): string {
  return path.join(dir, "blobs", sha);
}

function hashBlob(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function writeBlob(dir: string, content: string): Promise<string> {
  const sha = hashBlob(content);
  const dest = blobPath(dir, sha);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  try {
    await fs.writeFile(dest, content, { encoding: "utf8", flag: "wx" });
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: unknown }).code)
        : "";
    if (code !== "EEXIST") throw err;
  }
  return sha;
}

async function readBlob(dir: string, sha: string): Promise<string> {
  return fs.readFile(blobPath(dir, sha), "utf8");
}

export type CheckpointTurnStore = {
  getById: (id: string) => Promise<{
    id: string;
    sessionId: string;
    workspaceCheckpoint: unknown;
  } | null>;
  setWorkspaceCheckpoint: (
    id: string,
    checkpoint: WorkspaceCheckpointV1
  ) => Promise<unknown>;
  listBySessionId: (sessionId: string) => Promise<
    Array<{
      id: string;
      sessionId: string;
      workspaceCheckpoint: unknown;
    }>
  >;
};

function defaultTurnStore(): CheckpointTurnStore {
  return new ChatTurnRepository() as CheckpointTurnStore;
}

export async function recordTouchedFiles(options: {
  sessionId: string;
  turnId: string;
  files: TouchedFile[];
  turns?: CheckpointTurnStore;
}): Promise<WorkspaceCheckpointV1> {
  const { sessionId, turnId, files } = options;
  if (!TURN_ID_RE.test(turnId)) {
    throw new Error(`Unsafe checkpoint turn id: ${turnId}`);
  }
  const turns = options.turns ?? defaultTurnStore();
  if (files.length === 0) {
    const existing = await turns.getById(turnId);
    return (
      parseTouchedFileCheckpoint(existing?.workspaceCheckpoint) ?? {
        version: 1,
        files: []
      }
    );
  }
  const existingTurn = await turns.getById(turnId);
  const current = parseTouchedFileCheckpoint(
    existingTurn?.workspaceCheckpoint
  ) ?? {
    version: 1,
    files: []
  };
  const seen = new Set(current.files.map((f) => f.path));
  const dir = sessionCheckpointDir(sessionId, turnId);
  const nextFiles = [...current.files];
  for (const file of files) {
    if (seen.has(file.path)) continue;
    seen.add(file.path);
    let blob: string | null = null;
    if (file.before !== null) {
      blob = await writeBlob(dir, file.before);
    }
    nextFiles.push({ path: file.path, op: file.op, blob });
  }
  const checkpoint: WorkspaceCheckpointV1 = { version: 1, files: nextFiles };
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, "metadata.json"),
    `${JSON.stringify(checkpoint, null, 2)}\n`,
    "utf8"
  );
  await turns.setWorkspaceCheckpoint(turnId, checkpoint);
  return checkpoint;
}

function knownRepos(info: SessionRepoInfo): Set<string> | undefined {
  if (!info.worktrees) return undefined;
  const keys = Object.keys(info.worktrees);
  return keys.length > 0 ? new Set(keys) : undefined;
}

function sandboxAbs(info: SessionRepoInfo, rel: string): string {
  try {
    return resolveWorkspacePath(rel, { knownRepos: knownRepos(info) });
  } catch {
    return resolveWorkspacePath(rel);
  }
}

async function restorePlanFromRows(options: {
  sessionId: string;
  range: Array<{ id: string; workspaceCheckpoint: unknown }>;
}): Promise<RestoreEntry[]> {
  const earliest = new Map<string, RestoreEntry>();
  for (const row of options.range) {
    const parsed = parseTouchedFileCheckpoint(row.workspaceCheckpoint);
    if (!parsed) continue;
    const dir = sessionCheckpointDir(options.sessionId, row.id);
    for (const file of parsed.files) {
      if (earliest.has(file.path)) continue;
      if (file.blob === null) {
        earliest.set(file.path, { path: file.path, before: null });
        continue;
      }
      const before = await readBlob(dir, file.blob);
      earliest.set(file.path, { path: file.path, before });
    }
  }
  return [...earliest.values()];
}

export async function restorePlanFromTurn(options: {
  sessionId: string;
  turnId: string;
  turns?: CheckpointTurnStore;
}): Promise<RestoreEntry[]> {
  const { sessionId, turnId } = options;
  const turns = options.turns ?? defaultTurnStore();
  const rows = await turns.listBySessionId(sessionId);
  const start = rows.findIndex((row) => row.id === turnId);
  const range = start >= 0 ? rows.slice(start) : [];
  if (range.length === 0) {
    const single = await turns.getById(turnId);
    if (single && single.sessionId === sessionId) range.push(single);
  }
  return restorePlanFromRows({ sessionId, range });
}

export async function restorePlanAfterTurn(options: {
  sessionId: string;
  turnId: string;
  turns?: CheckpointTurnStore;
}): Promise<RestoreEntry[]> {
  const { sessionId, turnId } = options;
  const turns = options.turns ?? defaultTurnStore();
  const rows = await turns.listBySessionId(sessionId);
  const start = rows.findIndex((row) => row.id === turnId);
  if (start < 0) return [];
  return restorePlanFromRows({
    sessionId,
    range: rows.slice(start + 1)
  });
}

export async function copyCheckpointSidecar(options: {
  sourceSessionId: string;
  sourceTurnId: string;
  targetSessionId: string;
  targetTurnId: string;
}): Promise<void> {
  const src = sessionCheckpointDir(
    options.sourceSessionId,
    options.sourceTurnId
  );
  const dst = sessionCheckpointDir(
    options.targetSessionId,
    options.targetTurnId
  );
  try {
    await fs.access(src);
  } catch {
    return;
  }
  await fs.cp(src, dst, { recursive: true });
}

async function applyRestoredFile(options: {
  sessionId: string;
  info: SessionRepoInfo;
  host: boolean;
  entry: RestoreEntry;
}): Promise<void> {
  const { sessionId, info, host, entry } = options;
  if (host) {
    await applyHostRestore({ info, entry });
    return;
  }
  let abs: string;
  try {
    abs = sandboxAbs(info, entry.path);
  } catch {
    abs = resolveWorkspacePath(entry.path);
  }
  if (entry.before === null) {
    await deleteFileFromSandbox({
      container: info.containerName,
      absPath: abs,
      sessionId
    });
    return;
  }
  await writeFileToSandbox({
    container: info.containerName,
    sessionId,
    absPath: abs,
    content: entry.before
  });
}

async function applyHostRestore(options: {
  info: SessionRepoInfo;
  entry: RestoreEntry;
}): Promise<void> {
  const { info, entry } = options;
  const memberRoots = hostFsAllowlistRoots(info);
  const sessionRoot = path.resolve(info.hostWorkingDir ?? info.containerName);
  let abs: string;
  try {
    abs = resolveHostFsPath({
      info,
      logicalAbsPath: sandboxAbs(info, entry.path)
    });
  } catch {
    const segments = entry.path.split("/").filter((s) => s && s !== ".");
    if (segments.some((s) => s === "..")) {
      throw new Error(`Invalid restore path: ${entry.path}`);
    }
    abs = path.resolve(sessionRoot, ...segments);
    assertUnderAllowlist(abs, [sessionRoot]);
  }
  if (entry.before === null) {
    try {
      await fs.unlink(abs);
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: unknown }).code)
          : "";
      if (code !== "ENOENT") throw err;
    }
    return;
  }
  const roots = memberRoots.some(
    (root) => abs === root || abs.startsWith(`${root}${path.sep}`)
  )
    ? memberRoots
    : [sessionRoot];
  await writeHostWorkspaceFile({
    absPath: abs,
    content: entry.before,
    roots
  });
}

export async function restoreSessionWorkspaceFromTurn(options: {
  sessionId: string;
  turnId: string | null;
  turns?: CheckpointTurnStore;
}): Promise<{ workspaceRestored: boolean }> {
  const { sessionId, turnId } = options;
  if (!turnId) return { workspaceRestored: false };
  const plan = await restorePlanFromTurn({
    sessionId,
    turnId,
    turns: options.turns
  });
  if (plan.length === 0) return { workspaceRestored: false };
  await restoreSessionWorkspace({ sessionId, plan });
  return { workspaceRestored: true };
}

export async function restoreSessionWorkspace(options: {
  sessionId: string;
  plan: RestoreEntry[];
  info?: SessionRepoInfo;
  host?: boolean;
}): Promise<void> {
  const { sessionId, plan } = options;
  const info = options.info ?? (await resolveSandbox(sessionId));
  const host =
    options.host ??
    (await (
      await import("./sandboxRuntime/resolve.js")
    ).isHostSession(sessionId));
  for (const entry of plan) {
    await applyRestoredFile({ sessionId, info, host, entry });
  }
}
