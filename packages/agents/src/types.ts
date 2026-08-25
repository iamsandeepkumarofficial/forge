export type AgentCategory =
  | "planning"
  | "design"
  | "coding"
  | "testing"
  | "review"
  | "devops"
  | "maintenance";
export type ModelProvider = "anthropic" | "openai" | "openai-compatible";
export interface AgentModel {
  provider?: ModelProvider;
  name?: string;
  baseUrl?: string;
}
export interface AgentDefinition {
  id: string;
  name: string;
  category?: AgentCategory;
  description: string;
  model?: AgentModel;
  tools: string[];
  skills: string[];
  systemPrompt: string;
  webBudgets?: {
    maxSearches?: number;
    maxFetches?: number;
    maxTotal?: number;
  };
}
