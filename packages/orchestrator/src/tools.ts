import { tool, type Tool, type ToolSet } from "ai";
import { z } from "zod";
import {
  AGENT_MODE_IDS,
  MODE_TOOL_ALLOWLIST,
  effectiveToolMode,
  formatToolDescription,
  parseAgentMode,
  resolveChatAgentMode,
  type AgentMode
} from "@forge/core";
import { env } from "./env.js";
import { denyChatToolExecute } from "./chatToolGuard.js";

const N_500 = 500;
const N_8 = 8;

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

type ToolRun = (
  name: string,
  args: Record<string, unknown>
) => Promise<{
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}>;

export function webToolsEnabled(): boolean {
  const raw = process.env.WEB_TOOLS_ENABLED?.trim().toLowerCase();
  if (!raw) return false;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
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
  args: Record<string, unknown>;
  turnId?: string | null;
  agentMode?: AgentMode | null;
  webBudgets?: ToolForwardOpts["webBudgets"];
}): Promise<{
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}> {
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
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`tool-runner ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text) as {
      success: boolean;
      output: string;
      metadata?: Record<string, unknown>;
    };
  } catch {
    throw new Error(`tool-runner returned non-JSON: ${text.slice(0, N_500)}`);
  }
}

function workspaceFileTools(run: ToolRun): Record<string, Tool> {
  return {
    create_subtask: tool({
      description: formatToolDescription("create_subtask"),
      inputSchema: z.object({
        title: z.string(),
        type: z.enum(["feature", "bug", "refactor"]).optional()
      }),
      execute: async (input) =>
        run("create_subtask", input as Record<string, unknown>)
    }),
    read_file: tool({
      description: formatToolDescription("read_file"),
      inputSchema: z.object({ path: z.string() }),
      execute: async (input) =>
        run("read_file", input as Record<string, unknown>)
    }),
    write_file: tool({
      description: formatToolDescription("write_file"),
      inputSchema: z.object({ path: z.string(), content: z.string() }),
      execute: async (input) =>
        run("write_file", input as Record<string, unknown>)
    }),
    edit_file: tool({
      description: formatToolDescription("edit_file"),
      inputSchema: z.object({
        path: z.string(),
        oldString: z.string(),
        newString: z.string(),
        replaceAll: z.boolean().optional()
      }),
      execute: async (input) =>
        run("edit_file", input as Record<string, unknown>)
    }),
    list_files: tool({
      description: formatToolDescription("list_files"),
      inputSchema: z.object({}),
      execute: async () => run("list_files", {})
    }),
    search_codebase: tool({
      description: formatToolDescription("search_codebase"),
      inputSchema: z.object({ pattern: z.string() }),
      execute: async (input) =>
        run("search_codebase", input as Record<string, unknown>)
    })
  };
}

function shellTools(run: ToolRun): Record<string, Tool> {
  return {
    run_terminal: tool({
      description: formatToolDescription("run_terminal"),
      inputSchema: z.object({
        command: z.string().optional(),
        workingDirectory: z.string().optional(),
        background: z.boolean().optional(),
        jobName: z.string().optional(),
        action: z.enum(["run", "logs", "status", "stop"]).optional(),
        tail: z.number().optional()
      }),
      execute: async (input) =>
        run("run_terminal", input as Record<string, unknown>)
    })
  };
}

function previewTools(run: ToolRun): Record<string, Tool> {
  return {
    preview_start: tool({
      description: formatToolDescription("preview_start"),
      inputSchema: z.object({
        name: z.string().optional()
      }),
      execute: async (input) =>
        run("preview_start", input as Record<string, unknown>)
    }),
    preview_stop: tool({
      description: formatToolDescription("preview_stop"),
      inputSchema: z.object({ name: z.string() }),
      execute: async (input) =>
        run("preview_stop", input as Record<string, unknown>)
    }),
    preview_logs: tool({
      description: formatToolDescription("preview_logs"),
      inputSchema: z.object({
        name: z.string().optional(),
        tail: z.number().optional()
      }),
      execute: async (input) =>
        run("preview_logs", input as Record<string, unknown>)
    }),
    preview_status: tool({
      description: formatToolDescription("preview_status"),
      inputSchema: z.object({ name: z.string().optional() }),
      execute: async (input) =>
        run("preview_status", input as Record<string, unknown>)
    }),
    upsert_launch_app: tool({
      description: formatToolDescription("upsert_launch_app"),
      inputSchema: z.object({
        name: z.string(),
        cwd: z.string().describe(
          "App working directory. In workspaces, start with the member repo (e.g. bp-frontend or bp-frontend/apps/web)."
        ),
        command: z.string(),
        type: z.enum(["web", "api", "worker"]),
        repo: z
          .string()
          .optional()
          .describe(
            "Workspace member repo name (optional if cwd starts with the member name)."
          ),
        port: z
          .number()
          .optional()
          .describe(
            "Container listen port. Must be 3000–3009 (only those are published). Prefer 3000 for the first web app."
          )
      }),
      execute: async (input) =>
        run("upsert_launch_app", input as Record<string, unknown>)
    })
  };
}

function skillTools(run: ToolRun): Record<string, Tool> {
  return {
    list_skills: tool({
      description: formatToolDescription("list_skills"),
      inputSchema: z.object({}),
      execute: async () => run("list_skills", {})
    }),
    invoke_skill: tool({
      description: formatToolDescription("invoke_skill"),
      inputSchema: z.object({ skillId: z.string() }),
      execute: async (input) =>
        run("invoke_skill", input as Record<string, unknown>)
    })
  };
}

function setupTools(run: ToolRun): Record<string, Tool> {
  return {
    upsert_workspace_parameter: tool({
      description: formatToolDescription("upsert_workspace_parameter"),
      inputSchema: z.object({
        key: z.string(),
        value: z.string(),
        secret: z.boolean().optional()
      }),
      execute: async (input) =>
        run("upsert_workspace_parameter", input as Record<string, unknown>)
    }),
    docker_image_lookup: tool({
      description: formatToolDescription("docker_image_lookup"),
      inputSchema: z.object({
        query: z.string().optional(),
        engineId: z.enum(["postgres", "mongo"]).optional()
      }),
      execute: async (input) =>
        run("docker_image_lookup", input as Record<string, unknown>)
    }),
    provision_app_engine: tool({
      description: formatToolDescription("provision_app_engine"),
      inputSchema: z.object({
        engineId: z.enum(["postgres", "mongo"]),
        userApproved: z
          .boolean()
          .describe("Must be true only after the user explicitly approved.")
      }),
      execute: async (input) =>
        run("provision_app_engine", input as Record<string, unknown>)
    })
  };
}

function optionalWebTools(run: ToolRun): Record<string, Tool> {
  if (!webToolsEnabled()) return {};
  return {
    web_search: tool({
      description: formatToolDescription("web_search"),
      inputSchema: z.object({
        query: z.string(),
        maxResults: z.number().int().min(1).max(N_8).optional()
      }),
      execute: async (input) =>
        run("web_search", input as Record<string, unknown>)
    }),
    web_fetch: tool({
      description: formatToolDescription("web_fetch"),
      inputSchema: z.object({ url: z.string() }),
      execute: async (input) =>
        run("web_fetch", input as Record<string, unknown>)
    })
  };
}

function switchModeTool(currentMode: AgentMode): Record<string, Tool> {
  return {
    switch_mode: tool({
      description: formatToolDescription("switch_mode"),
      inputSchema: z.object({
        target: z.enum(AGENT_MODE_IDS)
      }),
      execute: async (input) => executeSwitchMode({ currentMode, input })
    })
  };
}

const askUserOptionSchema = z.object({
  id: z.string(),
  label: z.string()
});
const askUserFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  secret: z.boolean().optional(),
  placeholder: z.string().optional(),
  /** Prefill shown in the widget — use a sensible default whenever known. */
  value: z.string().optional()
});

function askUserTool(): Record<string, Tool> {
  return {
    ask_user: tool({
      description: formatToolDescription("ask_user"),
      inputSchema: z.object({
        kind: z.enum(["mcq", "form"]),
        prompt: z.string(),
        options: z.array(askUserOptionSchema).optional(),
        fields: z.array(askUserFieldSchema).optional()
      }),
      execute: async (input) => executeAskUser(input)
    })
  };
}

export type AskUserInput = {
  kind: string;
  prompt: string;
  options?: Array<{ id: string; label: string }>;
  fields?: Array<{
    id: string;
    label: string;
    secret?: boolean;
    placeholder?: string;
    value?: string;
  }>;
};

export function executeAskUser(input: AskUserInput): {
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
} {
  const kind = input.kind === "form" ? "form" : input.kind === "mcq" ? "mcq" : null;
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (!kind || !prompt) {
    return {
      success: false,
      output: "ask_user requires kind (mcq|form) and a non-empty prompt."
    };
  }
  if (kind === "mcq") {
    const options = (input.options ?? [])
      .filter((o) => o?.id?.trim() && o?.label?.trim())
      .map((o) => ({ id: o.id.trim(), label: o.label.trim() }));
    if (options.length < 2) {
      return {
        success: false,
        output: "ask_user mcq requires at least two options with id and label."
      };
    }
    return {
      success: true,
      output:
        "Waiting for the user to answer in the chat widget. Stop now — do not call more tools this turn.",
      metadata: {
        needsUserInput: true,
        kind: "mcq",
        prompt,
        options
      }
    };
  }
  const fields = (input.fields ?? [])
    .filter((f) => f?.id?.trim() && f?.label?.trim())
    .map((f) => ({
      id: f.id.trim(),
      label: f.label.trim(),
      ...(f.secret === true ? { secret: true } : {}),
      ...(typeof f.placeholder === "string" && f.placeholder.trim()
        ? { placeholder: f.placeholder.trim() }
        : {}),
      ...(typeof f.value === "string"
        ? { value: f.value }
        : {})
    }));
  if (fields.length < 1) {
    return {
      success: false,
      output: "ask_user form requires at least one field with id and label."
    };
  }
  return {
    success: true,
    output:
      "Waiting for the user to answer in the chat widget. Stop now — do not call more tools this turn. Form fields should include value defaults when known.",
    metadata: {
      needsUserInput: true,
      kind: "form",
      prompt,
      fields
    }
  };
}

export function executeSwitchMode(options: {
  currentMode: AgentMode;
  input: { target: string };
}): {
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
} {
  const target = parseAgentMode(options.input.target);
  if (!target) {
    return {
      success: false,
      output: `Invalid mode target: ${options.input.target}`
    };
  }
  if (options.currentMode !== "auto") {
    return {
      success: true,
      output:
        `Proposed switch to ${target}. Stop now and wait for the user to confirm ` +
        `in the mode picker. Do not call any more tools in this turn.`,
      metadata: { applied: false, target, needsConfirmation: true }
    };
  }
  return {
    success: true,
    output: `Switched to ${target} mode.`,
    metadata: { applied: true, target, mode: target }
  };
}

function toolRegistry(
  sessionId: string,
  opts?: ToolForwardOpts
): Record<string, Tool> {
  const agentMode = opts?.agentMode
    ? resolveChatAgentMode(opts.agentMode)
    : null;
  const run: ToolRun = (name, args) =>
    forward({
      sessionId,
      toolName: name,
      args,
      turnId: opts?.turnId,
      agentMode,
      webBudgets: opts?.webBudgets
    });
  const currentMode = agentMode ?? "ask";
  return {
    ...workspaceFileTools(run),
    ...shellTools(run),
    ...previewTools(run),
    ...skillTools(run),
    ...setupTools(run),
    ...optionalWebTools(run),
    ...switchModeTool(currentMode),
    ...askUserTool()
  };
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
}): Promise<{
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}> {
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
