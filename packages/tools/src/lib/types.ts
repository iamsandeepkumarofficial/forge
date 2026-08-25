export interface ToolParameterSchema {
  type: string;
  required?: boolean;
  description?: string;
}
export interface ToolContext {
  cwd: string;
  sessionId: string;
  repoNames?: string[];
}
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameterSchema>;
  execute: (
    args: Record<string, unknown>,
    context: ToolContext
  ) => Promise<ToolExecutionResult>;
}
export interface ToolExecutionResult {
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}
