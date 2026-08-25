export const MAX_TOOL_ROUNDS = 500;

export const LENGTH_TOOL_ERROR =
  "was not executed: the response hit the output token limit, so its arguments may be truncated. Re-issue the tool call with complete arguments.";

export function isLengthFinishReason(reason: string): boolean {
  const r = reason.trim().toLowerCase();
  return r === "length" || r === "max_tokens";
}

export function truncatedToolCallOutput(toolName: string): string {
  return `Tool call "${toolName}" ${LENGTH_TOOL_ERROR}`;
}

export function roundCapNotice(maxRounds: number): string {
  return `Stopped after ${maxRounds} tool rounds. Send another message to continue.`;
}
