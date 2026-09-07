import type { ToolSet } from "ai";
import {
  MODE_TOOL_ALLOWLIST,
  effectiveToolMode,
  resolveChatAgentMode,
  type AgentMode
} from "@forge/core";
import {
  createChatToolRegistry,
  executeAskUser,
  executeSwitchMode,
  type AskUserInput,
  type ToolResult
} from "@forge/tools";
import { env } from "./env.js";
import { denyChatToolExecute } from "./chatToolGuard.js";

export type { AskUserInput } from "@forge/tools";
export { executeAskUser, executeSwitchMode } from "@forge/tools";

const N_500 = 500;
const WEB_TOOL_NAMES = ["web_search", "web_fetch"] as const;

export type ToolForwardOpts = {
  turnId?: string | null;
  agentMode?: AgentMode | string | null;
  webBudgets?: {
    maxSearches?: number;
    maxFetches?: number;
    maxTotal?: number;
  } | null;
};

export function webToolsEnabled(): boolean {
  const raw = process.env.WEB_TOOLS_ENABLED?.trim().toLowerCase();
  if (!raw) return false;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function hostModeHidesDockerImageLookup(): boolean {
  const raw = process.env.SANDBOX_RUNTIME?.trim().toLowerCase();
  if (raw === "host") return true;
  if (raw === "docker" || raw === "kubernetes" || raw === "k8s") return false;
  return process.env.FORGE_DESKTOP?.trim() === "1";
}

export function withWebToolsIfEnabled(allowed: string[]): string[] {
  if (!webToolsEnabled() || allowed.length === 0) return allowed;
  const next = [...allowed];
  for (const name of WEB_TOOL_NAMES) {
    if (!next.includes(name)) next.push(name);
  }
  return next;
}

async function forward(opts: {
  sessionId: string;
  toolName: string;
  args: object;
  turnId?: string | null;
  agentMode?: AgentMode | null;
  webBudgets?: ToolForwardOpts["webBudgets"];
}): Promise<ToolResult> {
  const body: Record<string, unknown> = {
    sessionId: opts.sessionId,
    toolName: opts.toolName,
    args: opts.args
  };
  if (opts.turnId) body.turnId = opts.turnId;
  if (opts.agentMode) body.agentMode = opts.agentMode;
  if (opts.webBudgets) body.webBudgets = opts.webBudgets;
  const res = await fetch(`${env.toolRunnerUrl}/internal/tool-execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`tool-runner ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text) as ToolResult;
  } catch {
    throw new Error(`tool-runner returned non-JSON: ${text.slice(0, N_500)}`);
  }
}

function toolRegistry(sessionId: string, opts?: ToolForwardOpts) {
  const agentMode = opts?.agentMode
    ? resolveChatAgentMode(opts.agentMode)
    : null;
  const currentMode = agentMode ?? "ask";
  return createChatToolRegistry({
    run: (name, args) =>
      forward({
        sessionId,
        toolName: name,
        args,
        turnId: opts?.turnId,
        agentMode,
        webBudgets: opts?.webBudgets
      }),
    currentMode,
    includeWebTools: webToolsEnabled(),
    includeDockerImageLookup: !hostModeHidesDockerImageLookup()
  });
}

export function availableToolNames(): string[] {
  return Object.keys(toolRegistry("_"));
}

export function buildTools(opts: {
  sessionId: string;
  allowed: string[];
  turnId?: string | null;
  agentMode?: AgentMode | string | null;
  webBudgets?: ToolForwardOpts["webBudgets"];
}): ToolSet {
  const registry = toolRegistry(opts.sessionId, {
    turnId: opts.turnId,
    agentMode: opts.agentMode,
    webBudgets: opts.webBudgets
  });
  const set: ToolSet = {};
  for (const name of withWebToolsIfEnabled(opts.allowed)) {
    if (registry[name]) {
      set[name] = registry[name];
    } else {
      console.warn(
        `[orchestrator] agent requested unknown tool "${name}" — skipping`
      );
    }
  }
  return set;
}

export function buildChatTools(opts: {
  sessionId: string;
  mode: AgentMode | "plan" | "build";
  turnId?: string | null;
  webBudgets?: ToolForwardOpts["webBudgets"];
}): ToolSet {
  const agentMode = resolveChatAgentMode(opts.mode);
  const registry = toolRegistry(opts.sessionId, {
    turnId: opts.turnId,
    agentMode,
    webBudgets: opts.webBudgets
  });
  const allowed = MODE_TOOL_ALLOWLIST[effectiveToolMode(agentMode)];
  const set: ToolSet = {};
  for (const name of allowed) {
    if (registry[name]) set[name] = registry[name];
  }
  return set;
}

export async function executeNamedTool(opts: {
  sessionId: string;
  toolName: string;
  args: Record<string, unknown>;
  turnId?: string | null;
  agentMode?: AgentMode | string | null;
  webBudgets?: ToolForwardOpts["webBudgets"];
}): Promise<ToolResult> {
  const agentMode = resolveChatAgentMode(opts.agentMode);
  if (opts.toolName === "switch_mode") {
    const target = typeof opts.args.target === "string" ? opts.args.target : "";
    return executeSwitchMode({ currentMode: agentMode, input: { target } });
  }
  if (opts.toolName === "ask_user") {
    return executeAskUser(opts.args as AskUserInput);
  }
  const denied = denyChatToolExecute({
    agentMode,
    toolName: opts.toolName,
    args: opts.args
  });
  if (denied) {
    return denied;
  }
  return forward({
    sessionId: opts.sessionId,
    toolName: opts.toolName,
    args: opts.args,
    turnId: opts.turnId,
    agentMode,
    webBudgets: opts.webBudgets
  });
}
