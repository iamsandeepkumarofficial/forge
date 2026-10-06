import {
  Bug,
  Infinity as InfinityIcon,
  ListTodo,
  MessageSquare,
  Sparkles
} from "lucide-react";
import type { ChatMode, LlmProvider } from "../lib/chat-agent.js";

export const N_100 = 100;
export const N_1000 = 1000;
export const N_1000000 = 1000000;

export type ComposerAgentMode = "agent" | "plan" | "debug" | "ask" | "auto";

export const AGENT_MODES: Array<{
  id: ComposerAgentMode;
  label: string;
  icon: typeof InfinityIcon;
  chatMode: ChatMode;
  enabled: boolean;
}> = [
  {
    id: "agent",
    label: "Agent",
    icon: InfinityIcon,
    chatMode: "agent",
    enabled: true
  },
  {
    id: "plan",
    label: "Plan",
    icon: ListTodo,
    chatMode: "plan",
    enabled: true
  },
  { id: "debug", label: "Debug", icon: Bug, chatMode: "debug", enabled: true },
  {
    id: "ask",
    label: "Ask",
    icon: MessageSquare,
    chatMode: "ask",
    enabled: true
  },
  {
    id: "auto",
    label: "Auto",
    icon: Sparkles,
    chatMode: "auto",
    enabled: true
  }
];

export const PROVIDER_LABELS: Record<LlmProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  "openai-compatible": "OpenAI-compatible"
};

export const ALL_PROVIDERS: LlmProvider[] = [
  "openai",
  "anthropic",
  "openai-compatible"
];

export type ModelsByProvider = Partial<Record<LlmProvider, string[]>>;

export function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= N_1000000)
    return `${(n / N_1000000).toFixed(1)}M`.replace(/\.0M$/, "M");
  if (n >= N_1000) return `${Math.round(n / N_1000)}K`;
  return String(Math.round(n));
}
