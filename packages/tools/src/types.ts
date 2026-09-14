export type ToolResult = {
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
};

export type ToolRun = (name: string, args: object) => Promise<ToolResult>;

export type RegistryOptions = {
  includeWebTools?: boolean;
  includeDockerImageLookup?: boolean;
};
