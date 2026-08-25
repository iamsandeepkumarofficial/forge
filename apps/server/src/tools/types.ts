export interface ToolResult {
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}
export type ToolExecuteOutcome =
  | {
      kind: "result";
      status: number;
      body: ToolResult;
    }
  | {
      kind: "error";
      status: number;
      body: {
        error: string;
      };
    };
