import {
  deleteHostWorkspaceFile,
  hostWorkspaceFileExists,
  moveHostWorkspaceFile,
  readHostWorkspaceFile,
  resolveHostFsPath,
  writeHostWorkspaceFile
} from "../projects/hostWorkspaceFs.js";
import { resolveWorkspacePath } from "../projects/sandboxExec.js";
import type { SessionRepoInfo } from "../projects/sessionSandbox.js";
import {
  applyExactReplace,
  formatMutatingToolOutput,
  parseDeleteFilesArgs,
  parseEditFileArgs,
  parseMoveFilesArgs,
  parseWriteFileArgs,
  type TouchedFile
} from "./fileBatch.js";
import type { ToolResult } from "./types.js";

type MutateOpts = {
  info: SessionRepoInfo;
  roots: string[];
  args: Record<string, unknown>;
};

function knownRepos(info: SessionRepoInfo): Set<string> | undefined {
  if (!info.worktrees) return undefined;
  const keys = Object.keys(info.worktrees);
  return keys.length > 0 ? new Set(keys) : undefined;
}

function hostAbs(info: SessionRepoInfo, rel: string): string {
  return resolveHostFsPath({
    info,
    logicalAbsPath: resolveWorkspacePath(rel, {
      knownRepos: knownRepos(info)
    })
  });
}

export async function executeHostFsMutate(options: {
  info: SessionRepoInfo;
  roots: string[];
  toolName: string;
  args: Record<string, unknown>;
}): Promise<ToolResult | null> {
  const opts: MutateOpts = {
    info: options.info,
    roots: options.roots,
    args: options.args
  };
  switch (options.toolName) {
    case "write_file":
      return hostWriteFile(opts);
    case "edit_file":
      return hostEditFile(opts);
    case "delete_files":
      return hostDeleteFiles(opts);
    case "move_files":
      return hostMoveFiles(opts);
    default:
      return null;
  }
}

async function hostWriteFile(options: MutateOpts): Promise<ToolResult> {
  const parsed = parseWriteFileArgs(options.args);
  if (parsed.error) {
    return { success: false, output: parsed.error };
  }
  const files: TouchedFile[] = [];
  const ok: string[] = [];
  const failed: string[] = [];
  for (const entry of parsed.entries) {
    try {
      const abs = hostAbs(options.info, entry.path);
      const existed = await hostWorkspaceFileExists(abs, options.roots);
      const before = existed
        ? await readHostWorkspaceFile(abs, options.roots)
        : null;
      await writeHostWorkspaceFile({
        absPath: abs,
        content: entry.content,
        roots: options.roots
      });
      files.push({
        path: entry.path,
        op: existed ? "update" : "create",
        before
      });
      ok.push(entry.path);
    } catch (err) {
      failed.push(
        `${entry.path}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  return {
    success: failed.length === 0 && ok.length > 0,
    output: formatMutatingToolOutput({ verb: "Wrote", ok, failed }),
    metadata: { files }
  };
}

async function hostEditFile(options: MutateOpts): Promise<ToolResult> {
  const parsed = parseEditFileArgs(options.args);
  if (parsed.error) {
    return { success: false, output: parsed.error };
  }
  const files: TouchedFile[] = [];
  const ok: string[] = [];
  const failed: string[] = [];
  for (const entry of parsed.entries) {
    try {
      const abs = hostAbs(options.info, entry.path);
      const content = await readHostWorkspaceFile(abs, options.roots);
      if (content === null) {
        failed.push(`${entry.path}: File not found`);
        continue;
      }
      const replaced = applyExactReplace({
        content,
        oldString: entry.oldString,
        newString: entry.newString,
        replaceAll: entry.replaceAll
      });
      if ("error" in replaced) {
        failed.push(`${entry.path}: ${replaced.error}`);
        continue;
      }
      await writeHostWorkspaceFile({
        absPath: abs,
        content: replaced.updated,
        roots: options.roots
      });
      files.push({ path: entry.path, op: "update", before: content });
      ok.push(entry.path);
    } catch (err) {
      failed.push(
        `${entry.path}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  return {
    success: failed.length === 0 && ok.length > 0,
    output: formatMutatingToolOutput({
      verb: "Successfully edited",
      ok,
      failed
    }),
    metadata: { files }
  };
}

async function hostDeleteFiles(options: MutateOpts): Promise<ToolResult> {
  const parsed = parseDeleteFilesArgs(options.args);
  if (parsed.error) {
    return { success: false, output: parsed.error };
  }
  const files: TouchedFile[] = [];
  const ok: string[] = [];
  const failed: string[] = [];
  for (const rel of parsed.paths) {
    try {
      const abs = hostAbs(options.info, rel);
      const before = await readHostWorkspaceFile(abs, options.roots);
      if (before === null) {
        failed.push(`${rel}: File not found`);
        continue;
      }
      await deleteHostWorkspaceFile(abs, options.roots);
      files.push({ path: rel, op: "delete", before });
      ok.push(rel);
    } catch (err) {
      failed.push(
        `${rel}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  return {
    success: failed.length === 0 && ok.length > 0,
    output: formatMutatingToolOutput({ verb: "Deleted", ok, failed }),
    metadata: { files }
  };
}

async function hostMoveFiles(options: MutateOpts): Promise<ToolResult> {
  const parsed = parseMoveFilesArgs(options.args);
  if (parsed.error) {
    return { success: false, output: parsed.error };
  }
  const files: TouchedFile[] = [];
  const ok: string[] = [];
  const failed: string[] = [];
  for (const move of parsed.moves) {
    try {
      const fromAbs = hostAbs(options.info, move.from);
      const toAbs = hostAbs(options.info, move.to);
      const before = await readHostWorkspaceFile(fromAbs, options.roots);
      if (before === null) {
        failed.push(`${move.from}: File not found`);
        continue;
      }
      const destExisted = await hostWorkspaceFileExists(toAbs, options.roots);
      const destBefore = destExisted
        ? await readHostWorkspaceFile(toAbs, options.roots)
        : null;
      await moveHostWorkspaceFile({
        fromAbs,
        toAbs,
        roots: options.roots
      });
      files.push({ path: move.from, op: "delete", before });
      files.push({
        path: move.to,
        op: destExisted ? "update" : "create",
        before: destBefore
      });
      ok.push(`${move.from} → ${move.to}`);
    } catch (err) {
      failed.push(
        `${move.from}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  return {
    success: failed.length === 0 && ok.length > 0,
    output: formatMutatingToolOutput({ verb: "Moved", ok, failed }),
    metadata: { files }
  };
}
