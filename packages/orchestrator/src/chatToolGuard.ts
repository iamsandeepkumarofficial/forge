import {
  isLongRunningDevServerCommand,
  isToolAllowedForMode,
  longRunningDevServerDeniedMessage,
  toolDeniedMessage,
  type AgentMode
} from "@forge/core";

export function denyChatToolExecute(options: {
  agentMode: AgentMode;
  toolName: string;
  args: Record<string, unknown>;
}): { success: false; output: string } | null {
  if (
    !isToolAllowedForMode({
      agentMode: options.agentMode,
      toolName: options.toolName
    })
  ) {
    return {
      success: false,
      output: toolDeniedMessage({
        agentMode: options.agentMode,
        toolName: options.toolName
      })
    };
  }
  if (
    options.toolName === "run_terminal" &&
    typeof options.args.command === "string" &&
    isLongRunningDevServerCommand(options.args.command)
  ) {
    return {
      success: false,
      output: longRunningDevServerDeniedMessage()
    };
  }
  return null;
}
