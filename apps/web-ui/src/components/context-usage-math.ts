import { formatTokens, N_100 } from "./chat-composer-shared.js";
import { usableInputTokens } from "../lib/usable-input-tokens.js";

const CHARS_PER_TOKEN = 4;

export function estimateTokensFromText(text: string): number {
  return Math.round(text.length / CHARS_PER_TOKEN);
}

function sectionTokens(options: {
  systemPromptText: string;
  header: string;
  nextHeader: string;
}): number {
  const { systemPromptText, header, nextHeader } = options;
  if (!systemPromptText) return 0;
  const start = systemPromptText.indexOf(header);
  if (start < 0) return 0;
  const end = systemPromptText.indexOf(nextHeader, start + header.length);
  if (end < 0) return estimateTokensFromText(systemPromptText.slice(start));
  return estimateTokensFromText(systemPromptText.slice(start, end));
}

export function buildUsageRows(options: {
  systemPromptText: string;
  systemPromptLoading: boolean;
  toolDefinitionTokens: number;
  conversationTokens: number;
  maxContextTokens: number | null;
  maxOutputTokens: number | null;
}) {
  const systemPromptTokens = estimateTokensFromText(options.systemPromptText);
  const totalTokens =
    options.conversationTokens +
    systemPromptTokens +
    options.toolDefinitionTokens;
  const usable = usableInputTokens({
    contextWindow: options.maxContextTokens,
    maxOutputTokens: options.maxOutputTokens
  });
  const ratio = usable && usable > 0 ? Math.max(0, totalTokens / usable) : 0;
  const percentFull = Math.round(ratio * N_100);
  const usageSubtitle =
    usable && usable > 0
      ? `${percentFull}% Full · ~${formatTokens(totalTokens)} / ${formatTokens(usable)} Tokens`
      : `~${formatTokens(totalTokens)} Tokens · limit unknown`;
  const agentsMdTokens = sectionTokens({
    systemPromptText: options.systemPromptText,
    header: "## Repository instructions",
    nextHeader: "## Available skills"
  });
  const skillsTokens = sectionTokens({
    systemPromptText: options.systemPromptText,
    header: "## Available skills",
    nextHeader: "## __end__"
  });
  return {
    ratio,
    percentFull,
    usageSubtitle,
    rows: [
      {
        label: "System prompt",
        tokens: options.systemPromptLoading ? 0 : systemPromptTokens,
        dot: "bg-indigo-600/70"
      },
      {
        label: "Tool definitions",
        tokens: options.toolDefinitionTokens,
        dot: "bg-purple-700/70"
      },
      {
        label: "AGENTS.md",
        tokens: agentsMdTokens,
        dot: "bg-emerald-700/70"
      },
      { label: "Skills", tokens: skillsTokens, dot: "bg-amber-600/70" },
      { label: "Subagent definitions", tokens: 0, dot: "bg-slate-700/70" },
      {
        label: "Conversation",
        tokens: options.conversationTokens,
        dot: "bg-orange-700/70"
      }
    ]
  };
}
