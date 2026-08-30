import { toolPartName, type ToolPart } from "../../lib/tool-display.js";

type ChatStatus = "ready" | "submitted" | "streaming" | "error";

export function liveToolName(parts: ToolPart[]): string | undefined {
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if ((part.output ?? part.result) === undefined && !part.errorText) {
      return toolPartName(part);
    }
  }
  return undefined;
}

export function chatTurnActivity(options: {
  status: ChatStatus;
  waiting?: boolean;
  toolName?: string;
}): string | null {
  if (options.waiting) return "Waiting on you";
  if (options.status === "submitted") return "Thinking…";
  if (options.status !== "streaming") return null;
  if (options.toolName) return `Running ${options.toolName}…`;
  return "Running…";
}
