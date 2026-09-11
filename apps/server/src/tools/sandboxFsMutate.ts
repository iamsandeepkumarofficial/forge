import {
  deleteFileFromSandbox,
  moveFileInSandbox,
  pathExistsInSandbox,
  readFileFromSandbox,
  resolveWorkspacePath,
  writeFileToSandbox
} from "../projects/sandboxExec.js";
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
  containerName: string;
  sessionId: string;
  args: Record<string, unknown>;
  knownRepos?: Set<string>;
};

export async function executeSandboxFsMutate(options: {
  toolName: string;
  containerName: string;
  sessionId: string;
  args: Record<string, unknown>;
  knownRepos?: Set<string>;
}): Promise<ToolResult | null> {
  const opts: MutateOpts = {
    containerName: options.containerName,
    sessionId: options.sessionId,
    args: options.args,
    knownRepos: options.knownRepos
  };
  switch (options.toolName) {
    case "write_file":
      return handleWriteFile(opts);
    case "edit_file":
      return handleEditFile(opts);
    case "delete_files":
      return handleDeleteFiles(opts);
    case "move_files":
      return handleMoveFiles(opts);
    default:
      return null;
  }
}

async function handleWriteFile(options: MutateOpts): Promise<ToolResult> {
  const parsed = parseWriteFileArgs(options.args);
  if (parsed.error) {
    return { success: false, output: parsed.error };
  }
  const files: TouchedFile[] = [];
  const ok: string[] = [];
  const failed: string[] = [];
  for (const entry of parsed.entries) {
    try {
      const abs = resolveWorkspacePath(entry.path, {
        knownRepos: options.knownRepos
      });
      const existed = await pathExistsInSandbox({
        container: options.containerName,
        absPath: abs,
        sessionId: options.sessionId
      });
      const before = existed
        ? await readFileFromSandbox({
            container: options.containerName,
            absPath: abs,
            sessionId: options.sessionId
          })
        : null;
      await writeFileToSandbox({
        container: options.containerName,
        sessionId: options.sessionId,
        absPath: abs,
        content: entry.content
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

async function handleEditFile(options: MutateOpts): Promise<ToolResult> {
  const parsed = parseEditFileArgs(options.args);
  if (parsed.error) {
    return { success: false, output: parsed.error };
  }
  const files: TouchedFile[] = [];
  const ok: string[] = [];
  const failed: string[] = [];
  for (const entry of parsed.entries) {
    try {
      const abs = resolveWorkspacePath(entry.path, {
        knownRepos: options.knownRepos
      });
      const content = await readFileFromSandbox({
        container: options.containerName,
        absPath: abs,
        sessionId: options.sessionId
      });
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
      await writeFileToSandbox({
        container: options.containerName,
        sessionId: options.sessionId,
        absPath: abs,
        content: replaced.updated
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

async function handleDeleteFiles(options: MutateOpts): Promise<ToolResult> {
  const parsed = parseDeleteFilesArgs(options.args);
  if (parsed.error) {
    return { success: false, output: parsed.error };
  }
  const files: TouchedFile[] = [];
  const ok: string[] = [];
  const failed: string[] = [];
  for (const rel of parsed.paths) {
    try {
      const abs = resolveWorkspacePath(rel, { knownRepos: options.knownRepos });
      const before = await readFileFromSandbox({
        container: options.containerName,
        absPath: abs,
        sessionId: options.sessionId
      });
      if (before === null) {
        failed.push(`${rel}: File not found`);
        continue;
      }
      await deleteFileFromSandbox({
        container: options.containerName,
        absPath: abs,
        sessionId: options.sessionId
      });
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

async function handleMoveFiles(options: MutateOpts): Promise<ToolResult> {
  const parsed = parseMoveFilesArgs(options.args);
  if (parsed.error) {
    return { success: false, output: parsed.error };
  }
  const files: TouchedFile[] = [];
  const ok: string[] = [];
  const failed: string[] = [];
  for (const move of parsed.moves) {
    try {
      const fromAbs = resolveWorkspacePath(move.from, {
        knownRepos: options.knownRepos
      });
      const toAbs = resolveWorkspacePath(move.to, {
        knownRepos: options.knownRepos
      });
      const before = await readFileFromSandbox({
        container: options.containerName,
        absPath: fromAbs,
        sessionId: options.sessionId
      });
      if (before === null) {
        failed.push(`${move.from}: File not found`);
        continue;
      }
      const destExisted = await pathExistsInSandbox({
        container: options.containerName,
        absPath: toAbs,
        sessionId: options.sessionId
      });
      const destBefore = destExisted
        ? await readFileFromSandbox({
            container: options.containerName,
            absPath: toAbs,
            sessionId: options.sessionId
          })
        : null;
      await moveFileInSandbox({
        container: options.containerName,
        fromAbs,
        toAbs,
        sessionId: options.sessionId
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
