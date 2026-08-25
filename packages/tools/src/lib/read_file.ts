import fs from "node:fs/promises";
import type {
  ToolContext,
  ToolDefinition,
  ToolExecutionResult
} from "./types.js";
import { resolveSessionWorkspacePath } from "./utils.js";
export const readFileTool: ToolDefinition = {
  name: "read_file",
  description:
    "Read a file under the Forge session workspace. Paths are `<repoName>/relative/path` under the session root.",
  parameters: {
    path: { type: "string", required: true }
  },
  execute: async (
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolExecutionResult> => {
    const { path: filePath } = args as {
      path: string;
    };
    try {
      const { absPath, displayPath } = await resolveSessionWorkspacePath(
        context.cwd,
        String(filePath || "")
      );
      try {
        await fs.access(absPath);
      } catch {
        return { success: false, output: `File not found: ${displayPath}` };
      }
      const content = await fs.readFile(absPath, "utf8");
      const totalLines = content.split(/\r?\n/).length;
      return {
        success: true,
        output: `Read ${displayPath} (${totalLines} lines):\n${content}`
      };
    } catch (err) {
      return {
        success: false,
        output: err instanceof Error ? err.message : String(err)
      };
    }
  }
};
