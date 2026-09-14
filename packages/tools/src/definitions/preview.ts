import { tool, type Tool } from "ai";
import { formatToolDescription } from "@forge/core";
import type { ToolRun } from "../types.js";
import {
  previewLogsInputSchema,
  previewStartInputSchema,
  previewStatusInputSchema,
  previewStopInputSchema,
  upsertLaunchAppInputSchema
} from "../schemas.js";

export function previewTools(run: ToolRun): Record<string, Tool> {
  return {
    preview_start: tool({
      description: formatToolDescription("preview_start"),
      inputSchema: previewStartInputSchema,
      execute: async (input) => run("preview_start", input)
    }),
    preview_stop: tool({
      description: formatToolDescription("preview_stop"),
      inputSchema: previewStopInputSchema,
      execute: async (input) => run("preview_stop", input)
    }),
    preview_logs: tool({
      description: formatToolDescription("preview_logs"),
      inputSchema: previewLogsInputSchema,
      execute: async (input) => run("preview_logs", input)
    }),
    preview_status: tool({
      description: formatToolDescription("preview_status"),
      inputSchema: previewStatusInputSchema,
      execute: async (input) => run("preview_status", input)
    }),
    upsert_launch_app: tool({
      description: formatToolDescription("upsert_launch_app"),
      inputSchema: upsertLaunchAppInputSchema,
      execute: async (input) => run("upsert_launch_app", input)
    })
  };
}
