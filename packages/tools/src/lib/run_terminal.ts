import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type {
  ToolContext,
  ToolDefinition,
  ToolExecutionResult
} from "./types.js";
const execAsync = promisify(exec);
export const runTerminalTool: ToolDefinition = {
  name: "run_terminal",
  description:
    "Run a shell command. Default cwd is the session workspace root (not a git repo). For git, npm, or builds, pass workingDirectory as a repo folder name.",
  parameters: {
    command: { type: "string", required: true },
    workingDirectory: { type: "string" }
  },
  execute: async (
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolExecutionResult> => {
    const command = String(args.command || "").trim();
    if (!command) {
      return { success: false, output: "command is required" };
    }
    let cwd = context.cwd;
    const wdRaw = String(args.workingDirectory || "").trim();
    if (wdRaw) {
      cwd = path.resolve(context.cwd, wdRaw);
    } else if (command.startsWith("git")) {
      const repos = await listSessionRepoDirNames(context.cwd);
      if (repos.length === 1) {
        cwd = path.join(context.cwd, repos[0]);
      } else if (repos.length > 1) {
        return {
          success: false,
          output:
            `Session workspace root is not a git repository. Pass workingDirectory for git commands. ` +
            `Connected repos: ${repos.join(", ")}`
        };
      }
    }
    if (command.startsWith("git") && !(await isGitWorktreeDir(cwd))) {
      const repos = await listSessionRepoDirNames(context.cwd);
      const hint =
        repos.length > 0
          ? ` Pass workingDirectory (e.g. ${repos[0]}). Repos: ${repos.join(", ")}.`
          : " No git worktrees are linked under this session yet — connect repos and call prepare.";
      return {
        success: false,
        output: `Not a git repository: ${cwd}.${hint}`
      };
    }
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: 120000,
        shell:
          process.platform === "win32"
            ? process.env.ComSpec || "cmd.exe"
            : "/bin/sh"
      });
      const combined = [stdout, stderr]
        .filter((s) => s && s.length > 0)
        .join("\n");
      return { success: true, output: combined || "(no output)" };
    } catch (e: unknown) {
      const err = e as {
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      const piece =
        [err.stdout, err.stderr].filter((s) => s && s.length > 0).join("\n") ||
        err.message ||
        String(e);
      return { success: false, output: piece };
    }
  }
};
export async function listSessionRepoDirNames(
  basePath: string
): Promise<string[]> {
  try {
    const entries = await fs.readdir(basePath, { withFileTypes: true });
    const repos: string[] = [];
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith(".")) {
        const fullPath = path.join(basePath, e.name);
        if (await isGitWorktreeDir(fullPath)) {
          repos.push(e.name);
        }
      }
    }
    return repos.sort();
  } catch {
    return [];
  }
}
export async function isGitWorktreeDir(absDir: string): Promise<boolean> {
  const gitPath = path.join(absDir, ".git");
  try {
    const st = await fs.stat(gitPath);
    return st.isDirectory() || st.isFile();
  } catch {
    return false;
  }
}
