import {
  resolveSandbox,
  resolveWorkspacePath,
  dockerExec,
  shInSandbox,
  readFileFromSandbox,
  writeFileToSandbox
} from "../projects/sandboxExec.js";
import { getSessionRepoInfo } from "../projects/sessionSandbox.js";
import type { ToolResult } from "./types.js";
import {
  parseTerminalAction,
  runTerminalInSession
} from "./runTerminal.tool.js";
export { runTerminalInSession } from "./runTerminal.tool.js";
export {
  collectSandboxChanges,
  diffFileInSandbox
} from "./sandboxChanges.tool.js";
export const SANDBOX_TOOL_NAMES = new Set([
  "read_file",
  "write_file",
  "edit_file",
  "run_terminal",
  "search_codebase",
  "list_files",
  "list_dir"
]);
const READ_ONLY_FS_TOOLS = new Set([
  "read_file",
  "list_dir",
  "list_files",
  "search_codebase"
]);
const MAX_READ_CHARS = 40000;
const MAX_OUTPUT_CHARS = 20000;
const MAX_SEARCH_HITS = 200;
const MAX_LIST_FILES = 500;
function capChars(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}\n\n… (truncated ${text.length - max} more chars — narrow your request)`;
}
function capLines(text: string, maxLines: number): string {
  const lines = text.split("\n");
  if (lines.length <= maxLines) {
    return text;
  }
  return `${lines.slice(0, maxLines).join("\n")}\n\n… (${lines.length - maxLines} more lines truncated — narrow your request)`;
}
const SEARCH_SCRIPT = `
const fs = require('fs'); const path = require('path');
const base = process.env.BASE || '/workspace';
const root = process.env.ROOT || base;
let regex; try { regex = new RegExp(process.env.PATTERN || ''); }
catch (e) { console.error('Invalid RegExp: ' + e.message); process.exit(2); }
const hits = [];
function walk(dir) {
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) { walk(abs); continue; }
    if (!e.isFile()) continue;
    let st; try { st = fs.statSync(abs); } catch { continue; }
    if (st.size > 2000000) continue;
    let buf; try { buf = fs.readFileSync(abs); } catch { continue; }
    if (buf.includes(0)) continue;
    const rel = path.relative(base, abs).replace(/\\\\/g, '/');
    const lines = buf.toString('utf8').split(/\\r?\\n/);
    for (let i = 0; i < lines.length; i++) { regex.lastIndex = 0; if (regex.test(lines[i])) hits.push(rel + ':' + (i + 1) + ':' + lines[i]); }
  }
}
walk(root);
process.stdout.write(hits.join('\\n'));
`;

export function pathOpts(worktrees?: Record<string, string>): {
  knownRepos?: Set<string>;
} {
  if (!worktrees) return {};
  const keys = Object.keys(worktrees);
  if (keys.length === 0) return {};
  return { knownRepos: new Set(keys) };
}

async function handleReadFile(options: {
  containerName: string;
  sessionId: string;
  args: Record<string, unknown>;
  knownRepos?: Set<string>;
}): Promise<ToolResult> {
  const rel = String(options.args.path ?? "");
  try {
    const abs = resolveWorkspacePath(rel, {
      knownRepos: options.knownRepos
    });
    const content = await readFileFromSandbox({
      container: options.containerName,
      absPath: abs,
      sessionId: options.sessionId
    });
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
  } catch (err) {
    return {
      success: false,
      output: err instanceof Error ? err.message : String(err)
    };
  }
}
async function handleWriteFile(options: {
  containerName: string;
  sessionId: string;
  args: Record<string, unknown>;
  knownRepos?: Set<string>;
}): Promise<ToolResult> {
  const rel = String(options.args.path ?? "");
  try {
    const abs = resolveWorkspacePath(rel, {
      knownRepos: options.knownRepos
    });
    await writeFileToSandbox({
      container: options.containerName,
      sessionId: options.sessionId,
      absPath: abs,
      content: String(options.args.content ?? "")
    });
    return { success: true, output: `Wrote ${rel}` };
  } catch (err) {
    return {
      success: false,
      output: err instanceof Error ? err.message : String(err)
    };
  }
}
async function handleEditFile(options: {
  containerName: string;
  sessionId: string;
  args: Record<string, unknown>;
  knownRepos?: Set<string>;
}): Promise<ToolResult> {
  const rel = String(options.args.path ?? "");
  const oldString = String(options.args.oldString ?? "");
  const newString = String(options.args.newString ?? "");
  const replaceAll = Boolean(options.args.replaceAll);
  try {
    const abs = resolveWorkspacePath(rel, {
      knownRepos: options.knownRepos
    });
    const content = await readFileFromSandbox({
      container: options.containerName,
      absPath: abs,
      sessionId: options.sessionId
    });
    if (content === null) {
      return { success: false, output: `File not found: ${rel}` };
    }
    let updated: string;
    if (replaceAll) {
      updated = content.split(oldString).join(newString);
    } else {
      if (!content.includes(oldString)) {
        return {
          success: false,
          output: `Could not find the exact text to replace in ${rel}`
        };
      }
      updated = content.replace(oldString, newString);
    }
    await writeFileToSandbox({
      container: options.containerName,
      sessionId: options.sessionId,
      absPath: abs,
      content: updated
    });
    return { success: true, output: `Successfully edited ${rel}.` };
  } catch (err) {
    return {
      success: false,
      output: err instanceof Error ? err.message : String(err)
    };
  }
}
async function handleSearchCodebase(options: {
  containerName: string;
  sessionRoot: string;
  sessionId: string;
  args: Record<string, unknown>;
  knownRepos?: Set<string>;
}): Promise<ToolResult> {
  const pattern = String(options.args.pattern ?? "");
  if (!pattern) {
    return { success: false, output: "pattern is required" };
  }
  const searchPath = String(options.args.path ?? "").trim();
  try {
    const root = searchPath
      ? resolveWorkspacePath(searchPath, {
          knownRepos: options.knownRepos
        })
      : options.sessionRoot;
    const r = await dockerExec({
      container: options.containerName,
      sessionId: options.sessionId,
      argv: ["node"],
      input: SEARCH_SCRIPT,
      env: { PATTERN: pattern, ROOT: root, BASE: options.sessionRoot }
    });
    if (r.code !== 0) {
      return { success: false, output: r.stderr.trim() || "search failed" };
    }
    const out = r.stdout.trim();
    if (!out) {
      return { success: true, output: "No matches found." };
    }
    return {
      success: true,
      output: capChars(capLines(out, MAX_SEARCH_HITS), MAX_OUTPUT_CHARS)
    };
  } catch (err) {
    return {
      success: false,
      output: err instanceof Error ? err.message : String(err)
    };
  }
}
async function handleListFiles(options: {
  containerName: string;
  sessionRoot: string;
  sessionId: string;
}): Promise<ToolResult> {
  const r = await shInSandbox({
    container: options.containerName,
    sessionId: options.sessionId,
    script: `cd "${options.sessionRoot}" && find . -type f -not -path '*/.git/*' -not -path '*/node_modules/*' | sed 's|^\\./||' | sort`
  });
  const listed = r.stdout.trim();
  return {
    success: r.code === 0,
    output: listed
      ? capChars(capLines(listed, MAX_LIST_FILES), MAX_OUTPUT_CHARS)
      : "(empty)"
  };
}
async function handleListDir(options: {
  containerName: string;
  sessionRoot: string;
  sessionId: string;
  args: Record<string, unknown>;
  knownRepos?: Set<string>;
}): Promise<ToolResult> {
  const rel = String(options.args.path ?? "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  try {
    const abs = rel
      ? resolveWorkspacePath(rel, { knownRepos: options.knownRepos })
      : options.sessionRoot;
    const r = await shInSandbox({
      container: options.containerName,
      sessionId: options.sessionId,
      script: 'ls -Ap1 "$D" 2>/dev/null',
      env: { D: abs }
    });
    const entries = r.stdout
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter(
        (n) =>
          n !== ".git/" &&
          n !== "node_modules/" &&
          n !== ".next/" &&
          n !== "dist/" &&
          n !== "coverage/" &&
          n !== ".forge-runtime/"
      )
      .map((n) => {
        const isDir = n.endsWith("/");
        const name = isDir ? n.slice(0, -1) : n;
        const childPath = rel ? `${rel}/${name}` : name;
        return { name, path: childPath, isDir };
      })
      .sort((a, b) =>
        a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1
      );
    return {
      success: true,
      output: `${entries.length} entries`,
      metadata: { entries }
    };
  } catch (err) {
    return {
      success: false,
      output: err instanceof Error ? err.message : String(err)
    };
  }
}
export async function executeSandboxTool(options: {
  sessionId: string;
  toolName: string;
  args: Record<string, unknown>;
}): Promise<ToolResult> {
  const { sessionId, toolName, args } = options;
  const info = READ_ONLY_FS_TOOLS.has(toolName)
    ? await getSessionRepoInfo(sessionId)
    : await resolveSandbox(sessionId);
  const { containerName, sessionRoot, worktrees } = info;
  const { isHostSession } =
    await import("../projects/sandboxRuntime/resolve.js");
  if (await isHostSession(sessionId)) {
    const { executeHostSandboxFsTool } =
      await import("./sandboxHostFs.tool.js");
    const hostFs = await executeHostSandboxFsTool({ info, toolName, args });
    if (hostFs) return hostFs;
  }
  const known = pathOpts(worktrees);
  switch (toolName) {
    case "read_file":
      return handleReadFile({ containerName, sessionId, args, ...known });
    case "write_file":
      return handleWriteFile({ containerName, sessionId, args, ...known });
    case "edit_file":
      return handleEditFile({ containerName, sessionId, args, ...known });
    case "run_terminal":
      return runTerminalInSession({
        sessionId,
        command: String(args.command ?? ""),
        workingDirectory:
          String(args.workingDirectory ?? "").trim() || undefined,
        background: Boolean(args.background),
        jobName: String(args.jobName ?? "").trim() || undefined,
        action: parseTerminalAction(args.action),
        tail: typeof args.tail === "number" ? args.tail : undefined
      });
    case "search_codebase":
      return handleSearchCodebase({
        containerName,
        sessionRoot,
        sessionId,
        args,
        ...known
      });
    case "list_files":
      return handleListFiles({ containerName, sessionRoot, sessionId });
    case "list_dir":
      return handleListDir({
        containerName,
        sessionRoot,
        sessionId,
        args,
        ...known
      });
    default:
      return { success: false, output: `Unknown tool: ${toolName}` };
  }
}
