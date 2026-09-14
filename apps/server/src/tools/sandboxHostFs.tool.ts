import {
  hostFsAllowlistRoots,
  listHostWorkspaceDir,
  listHostWorkspaceFiles,
  readHostWorkspaceFile,
  resolveHostFsPath,
  searchHostWorkspace
} from "../projects/hostWorkspaceFs.js";
import { resolveWorkspacePath } from "../projects/sandboxExec.js";
import type { SessionRepoInfo } from "../projects/sessionSandbox.js";
import { executeHostFsMutate } from "./sandboxHostFsMutate.js";
import type { ToolResult } from "./types.js";

const MAX_READ_CHARS = 40000;
const MAX_OUTPUT_CHARS = 20000;
const MAX_SEARCH_HITS = 200;
const MAX_LIST_FILES = 500;

function capChars(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n… (truncated ${text.length - max} more chars — narrow your request)`;
}

function capLines(text: string, maxLines: number): string {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  return `${lines.slice(0, maxLines).join("\n")}\n\n… (${lines.length - maxLines} more lines truncated — narrow your request)`;
}

function knownRepos(info: SessionRepoInfo): Set<string> | undefined {
  if (!info.worktrees) return undefined;
  const keys = Object.keys(info.worktrees);
  return keys.length > 0 ? new Set(keys) : undefined;
}

function logicalPath(rel: string, info: SessionRepoInfo): string {
  return resolveWorkspacePath(rel, { knownRepos: knownRepos(info) });
}

function workspaceMemberNames(info: SessionRepoInfo): string[] {
  const trees = info.worktrees ?? info.hostWorktrees;
  return trees ? Object.keys(trees).sort() : [];
}

function hostRoot(info: SessionRepoInfo): string {
  return info.hostWorkingDir ?? info.containerName;
}

export async function executeHostSandboxFsTool(options: {
  info: SessionRepoInfo;
  toolName: string;
  args: Record<string, unknown>;
}): Promise<ToolResult | null> {
  const { info, toolName, args } = options;
  const roots = hostFsAllowlistRoots(info);
  try {
    switch (toolName) {
      case "read_file":
        return await hostReadFile({ info, roots, args });
      case "write_file":
      case "edit_file":
      case "delete_files":
      case "move_files":
        return await executeHostFsMutate({ info, roots, toolName, args });
      case "search_codebase":
        return await hostSearch({ info, roots, args });
      case "list_files":
        return await hostListFiles({ info, roots });
      case "list_dir":
        return await hostListDir({ info, roots, args });
      default:
        return null;
    }
  } catch (err) {
    return {
      success: false,
      output: err instanceof Error ? err.message : String(err)
    };
  }
}

async function hostReadFile(options: {
  info: SessionRepoInfo;
  roots: string[];
  args: Record<string, unknown>;
}): Promise<ToolResult> {
  const rel = String(options.args.path ?? "");
  const abs = resolveHostFsPath({
    info: options.info,
    logicalAbsPath: logicalPath(rel, options.info)
  });
  const content = await readHostWorkspaceFile(abs, options.roots);
  if (content === null) {
    return { success: false, output: `File not found: ${rel}` };
  }
  const totalLines = content.split(/\r?\n/).length;
  const clipped = capChars(content, MAX_READ_CHARS);
  return {
    success: true,
    output: `Read ${rel} (${totalLines} lines):\n${clipped}`,
    metadata: { content: clipped, totalLines }
  };
}

async function hostSearch(options: {
  info: SessionRepoInfo;
  roots: string[];
  args: Record<string, unknown>;
}): Promise<ToolResult> {
  const pattern = String(options.args.pattern ?? "");
  if (!pattern) {
    return { success: false, output: "pattern is required" };
  }
  const searchPath = String(options.args.path ?? "").trim();
  const trees = options.info.hostWorktrees;
  if (!searchPath && trees && Object.keys(trees).length > 0) {
    const hits: string[] = [];
    for (const [repo, root] of Object.entries(trees)) {
      if (hits.length >= MAX_SEARCH_HITS) break;
      const found = await searchHostWorkspace({
        baseRoot: root,
        searchRoot: root,
        pattern,
        roots: options.roots,
        maxHits: MAX_SEARCH_HITS - hits.length
      });
      for (const h of found) {
        hits.push(`${repo}/${h}`);
      }
    }
    if (hits.length === 0) {
      return { success: true, output: "No matches found." };
    }
    return {
      success: true,
      output: capChars(
        capLines(hits.join("\n"), MAX_SEARCH_HITS),
        MAX_OUTPUT_CHARS
      )
    };
  }
  const baseRoot = hostRoot(options.info);
  const searchRoot = searchPath
    ? resolveHostFsPath({
        info: options.info,
        logicalAbsPath: logicalPath(searchPath, options.info)
      })
    : baseRoot;
  const hits = await searchHostWorkspace({
    baseRoot,
    searchRoot,
    pattern,
    roots: options.roots,
    maxHits: MAX_SEARCH_HITS
  });
  if (hits.length === 0) {
    return { success: true, output: "No matches found." };
  }
  return {
    success: true,
    output: capChars(
      capLines(hits.join("\n"), MAX_SEARCH_HITS),
      MAX_OUTPUT_CHARS
    )
  };
}

async function hostListFiles(options: {
  info: SessionRepoInfo;
  roots: string[];
}): Promise<ToolResult> {
  const trees = options.info.hostWorktrees;
  let listed: string[];
  if (trees && Object.keys(trees).length > 0) {
    listed = [];
    for (const [repo, root] of Object.entries(trees)) {
      const files = await listHostWorkspaceFiles(root, options.roots);
      for (const f of files) {
        listed.push(`${repo}/${f}`);
      }
    }
    listed.sort();
  } else {
    listed = await listHostWorkspaceFiles(
      hostRoot(options.info),
      options.roots
    );
  }
  return {
    success: true,
    output: listed.length
      ? capChars(capLines(listed.join("\n"), MAX_LIST_FILES), MAX_OUTPUT_CHARS)
      : "(empty)"
  };
}

async function hostListDir(options: {
  info: SessionRepoInfo;
  roots: string[];
  args: Record<string, unknown>;
}): Promise<ToolResult> {
  const rel = String(options.args.path ?? "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  if (!rel) {
    const names = workspaceMemberNames(options.info);
    if (names.length > 0) {
      const entries = names.map((name) => ({
        name,
        path: name,
        isDir: true
      }));
      return {
        success: true,
        output: `${entries.length} entries`,
        metadata: { entries }
      };
    }
  }
  const abs = rel
    ? resolveHostFsPath({
        info: options.info,
        logicalAbsPath: logicalPath(rel, options.info)
      })
    : hostRoot(options.info);
  const entries = await listHostWorkspaceDir({
    absPath: abs,
    relPrefix: rel,
    roots: options.roots
  });
  return {
    success: true,
    output: `${entries.length} entries`,
    metadata: { entries }
  };
}
