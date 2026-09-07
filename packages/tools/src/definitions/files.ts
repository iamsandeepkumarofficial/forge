import { tool, type Tool } from "ai";
import { formatToolDescription } from "@forge/core";
import type { ToolRun } from "../types.js";
import {
  createSubtaskInputSchema,
  editFileInputSchema,
  listFilesInputSchema,
  readFileInputSchema,
  searchCodebaseInputSchema,
  writeFileInputSchema
} from "../schemas.js";

export function workspaceFileTools(run: ToolRun): Record<string, Tool> {
  return {
    create_subtask: tool({
      description: formatToolDescription("create_subtask"),
      inputSchema: createSubtaskInputSchema,
      execute: async (input) => run("create_subtask", input)
    }),
    read_file: tool({
      description: formatToolDescription("read_file"),
      inputSchema: readFileInputSchema,
      execute: async (input) => run("read_file", input)
    }),
    write_file: tool({
      description: formatToolDescription("write_file"),
      inputSchema: writeFileInputSchema,
      execute: async (input) => run("write_file", input)
    }),
    edit_file: tool({
      description: formatToolDescription("edit_file"),
      inputSchema: editFileInputSchema,
      execute: async (input) => run("edit_file", input)
    }),
    list_files: tool({
      description: formatToolDescription("list_files"),
      inputSchema: listFilesInputSchema,
      execute: async () => run("list_files", {})
    }),
    search_codebase: tool({
      description: formatToolDescription("search_codebase"),
      inputSchema: searchCodebaseInputSchema,
      execute: async (input) => run("search_codebase", input)
    })
  };
}
