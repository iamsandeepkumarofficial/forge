import fs from "node:fs/promises";
import type {
  ToolContext,
  ToolDefinition,
  ToolExecutionResult
} from "./types.js";
import { resolveSessionWorkspacePath } from "./utils.js";
export const editFileTool: ToolDefinition = {
  name: "edit_file",
  description:
    "Edit a file by replacing a specific block of text with new content. This is designed for precise, line-by-line or block replacements. If the 'oldString' is not found exactly, the operation fails.",
  parameters: {
    path: { type: "string" },
    oldString: { type: "string" },
    newString: { type: "string" },
    replaceAll: { type: "boolean" }
  },
  execute: async (
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolExecutionResult> => {
    const {
      path: filePath,
      oldString,
      newString,
      replaceAll = false
    } = args as {
      path: string;
      oldString: string;
      newString: string;
      replaceAll?: boolean;
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
      let updatedContent: string;
      if (replaceAll) {
        updatedContent = content.split(oldString).join(newString);
      } else {
        if (!content.includes(oldString)) {
          return {
            success: false,
            output: `Could not find the exact text to replace in ${displayPath}`
          };
        }
        updatedContent = content.replace(oldString, newString);
      }
      await fs.writeFile(absPath, updatedContent, "utf8");
      return {
        success: true,
        output: `Successfully edited ${displayPath}.`
      };
    } catch (err) {
      return {
        success: false,
        output: err instanceof Error ? err.message : String(err)
      };
    }
  }
};
