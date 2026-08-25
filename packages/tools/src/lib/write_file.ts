import fs from "node:fs/promises";
import path from "node:path";
import type {
  ToolContext,
  ToolDefinition,
  ToolExecutionResult
} from "./types.js";
import { resolveSessionWorkspacePath } from "./utils.js";
export const writeFileTool: ToolDefinition = {
  name: "write_file",
  description:
    "Write a file under the Forge session workspace. Paths are `<repoName>/relative/path` under the session root.",
  parameters: {
    path: {
      type: "string",
      required: true,
      description: "The relative path to write the file to"
    },
    content: {
      type: "string",
      required: true,
      description: "The full content of the file"
    }
  },
  execute: async (
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolExecutionResult> => {
    const { path: filePath, content: fileContent } = args as {
      path: string;
      content: string;
    };
    try {
      const { absPath, displayPath } = await resolveSessionWorkspacePath(
        context.cwd,
        String(filePath || "")
      );
      await fs.mkdir(path.dirname(absPath), { recursive: true });
      await fs.writeFile(absPath, String(fileContent || ""), "utf8");
      return { success: true, output: `Wrote ${displayPath}` };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, output: message };
    }
  }
};
