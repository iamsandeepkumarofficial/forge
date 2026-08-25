import fs from "node:fs/promises";
import path from "node:path";
import type { Dirent } from "node:fs";
import type {
  ToolContext,
  ToolDefinition,
  ToolExecutionResult
} from "./types.js";

const N_2000000 = 2000000;

export const searchCodebaseTool: ToolDefinition = {
  name: "search_codebase",
  description:
    "Search the codebase for a pattern. Returns matching lines with file paths and line numbers.",
  parameters: {
    pattern: { type: "string", required: true },
    path: { type: "string" },
    fileGlob: { type: "string" }
  },
  execute: async (
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolExecutionResult> => {
    const {
      pattern,
      path: searchPath,
      fileGlob
    } = args as {
      pattern: string;
      path?: string;
      fileGlob?: string;
    };
    if (!pattern) {
      return { success: false, output: "pattern is required" };
    }
    try {
      const regex = new RegExp(pattern);
      const root = searchPath
        ? path.resolve(context.cwd, searchPath)
        : context.cwd;
      const hits: string[] = [];
      const fileResults = await searchWorkspaceFiles(root, fileGlob || "*");
      const files: string[] =
        typeof fileResults.output === "string"
          ? fileResults.output.split("\n")
          : [];
      for (const file of files) {
        let content;
        try {
          content = await fs.readFile(file, "utf8");
        } catch {
          continue;
        }
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          regex.lastIndex = 0;
          if (regex.test(lines[i])) {
            const rel = path.relative(context.cwd, file).replace(/\\/g, "/");
            hits.push(`${rel}:${i + 1}:${lines[i]}`);
          }
        }
      }
      return {
        success: true,
        output: hits.length > 0 ? hits.join("\n") : "No matches found."
      };
    } catch (err) {
      return {
        success: false,
        output: err instanceof Error ? err.message : String(err)
      };
    }
  }
};
export async function collectRelFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(absDir: string, relDir: string): Promise<void> {
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
      const kind = await entryKind(abs, e);
      if (kind === "dir") {
        await walk(abs, rel);
      } else if (kind === "file") {
        out.push(rel.replace(/\\/g, "/"));
      }
    }
  }
  await walk(path.resolve(root), "");
  return out.sort();
}
async function entryKind(
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
export async function isGitWorktreeDir(absDir: string): Promise<boolean> {
  const gitPath = path.join(absDir, ".git");
  try {
    const st = await fs.stat(gitPath);
    return st.isDirectory() || st.isFile();
  } catch {
    return false;
  }
}
export async function searchWorkspaceFiles(
  root: string,
  pattern: string
): Promise<{
  output: string;
  error?: string;
}> {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern);
  } catch (err) {
    return {
      output: "",
      error: `Invalid RegExp pattern: ${err instanceof Error ? err.message : String(err)}`
    };
  }
  const hits: string[] = [];
  const resolved = path.resolve(root);
  async function walk(absDir: string, relDir: string): Promise<void> {
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
      const kind = await entryKind(abs, e);
      if (kind === "dir") {
        await walk(abs, rel);
      } else if (kind === "file") {
        let st;
        try {
          st = await fs.stat(abs);
        } catch {
          continue;
        }
        if (!st.isFile() || st.size > N_2000000) {
          continue;
        }
        let buf: Buffer;
        try {
          buf = await fs.readFile(abs);
        } catch {
          continue;
        }
        if (buf.includes(0)) {
          continue;
        }
        const text = buf.toString("utf8");
        const lines = text.split(/\r?\n/);
        const relPosix = rel.replace(/\\/g, "/");
        for (let i = 0; i < lines.length; i++) {
          regex.lastIndex = 0;
          if (regex.test(lines[i])) {
            hits.push(`${relPosix}:${i + 1}:${lines[i]}`);
          }
        }
      }
    }
  }
  await walk(resolved, "");
  return { output: hits.join("\n") };
}
