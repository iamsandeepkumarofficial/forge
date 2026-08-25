import fs from "node:fs/promises";
import path from "node:path";
import type { Dirent } from "node:fs";
import type {
  ToolContext,
  ToolDefinition,
  ToolExecutionResult
} from "./types.js";
export class ToolEngine {
  private tools: Map<string, ToolDefinition> = new Map();
  constructor(tools: ToolDefinition[]) {
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }
  listTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }
  async execute(opts: {
    toolName: string;
    args: Record<string, unknown>;
    context: ToolContext;
  }): Promise<ToolExecutionResult> {
    const { toolName, args, context } = opts;
    const tool = this.tools.get(toolName);
    if (!tool) {
      return { success: false, output: `Unknown tool: ${toolName}` };
    }
    try {
      const result = await tool.execute(args, context);
      return result;
    } catch (err) {
      return {
        success: false,
        output: err instanceof Error ? err.message : String(err)
      };
    }
  }
  async resolveSessionWorkspacePath(
    cwd: string,
    relativePath: string
  ): Promise<{
    absPath: string;
    displayPath: string;
  }> {
    const resolved = path.resolve(cwd, relativePath);
    return {
      absPath: resolved,
      displayPath: relativePath || resolved
    };
  }
  async isGitWorktreeDir(absDir: string): Promise<boolean> {
    const gitPath = path.join(absDir, ".git");
    try {
      const st = await fs.stat(gitPath);
      return st.isDirectory() || st.isFile();
    } catch {
      return false;
    }
  }
  async listSessionRepoDirNames(basePath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(basePath, { withFileTypes: true });
      const repos: string[] = [];
      for (const e of entries) {
        if (e.isDirectory() && !e.name.startsWith(".")) {
          const fullPath = path.join(basePath, e.name);
          if (await this.isGitWorktreeDir(fullPath)) {
            repos.push(e.name);
          }
        }
      }
      return repos.sort();
    } catch {
      return [];
    }
  }
  async collectRelFiles(root: string): Promise<string[]> {
    const out: string[] = [];
    const walk = async (absDir: string, relDir: string): Promise<void> => {
      let entries: Dirent[];
      try {
        entries = await fs.readdir(absDir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (e.name === ".git") {
          continue;
        }
        const rel = relDir ? `${relDir}/${e.name}` : e.name;
        const abs = path.join(absDir, e.name);
        const kind = await this.entryKind(abs, e);
        if (kind === "dir") {
          await walk(abs, rel);
        } else if (kind === "file") {
          out.push(rel.replace(/\\/g, "/"));
        }
      }
    };
    await walk(path.resolve(root), "");
    return out.sort();
  }
  private async entryKind(
    abs: string,
    d: Dirent
  ): Promise<"dir" | "file" | "skip"> {
    if (d.isDirectory()) {
      return "dir";
    }
    if (d.isFile()) {
      return "file";
    }
    if (d.isSymbolicLink()) {
      try {
        const st = await fs.stat(abs);
        if (st.isDirectory()) {
          return "dir";
        }
        if (st.isFile()) {
          return "file";
        }
      } catch {
        void 0;
      }
    }
    return "skip";
  }
}
