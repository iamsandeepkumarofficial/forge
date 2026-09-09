export const AGENT_MODE_IDS = [
  "agent",
  "plan",
  "debug",
  "ask",
  "multitask",
  "auto"
] as const;

export type AgentMode = (typeof AGENT_MODE_IDS)[number];

const READ_TOOLS = ["read_file", "list_files", "search_codebase"] as const;
const WRITE_TOOLS = ["write_file", "edit_file", "run_terminal"] as const;
const PREVIEW_INSPECT_TOOLS = ["preview_status", "preview_logs"] as const;
const PREVIEW_RUN_TOOLS = ["preview_start", "preview_stop"] as const;
const LAUNCH_TOOLS = ["upsert_launch_app"] as const;
const SKILL_TOOLS = ["list_skills", "invoke_skill"] as const;
const WEB_TOOLS = ["web_search", "web_fetch"] as const;
const SWITCH_TOOLS = ["switch_mode"] as const;
const ASK_USER_TOOLS = ["ask_user"] as const;
const SUBTASK_TOOLS = ["create_subtask"] as const;
const SETUP_TOOLS = [
  "upsert_workspace_parameter",
  "docker_image_lookup",
  "setup_project_infra",
  "install_project_infra"
] as const;

function unionTools(...groups: readonly (readonly string[])[]): Set<string> {
  return new Set(groups.flat());
}

const AGENT_TOOLS = unionTools(
  READ_TOOLS,
  WRITE_TOOLS,
  PREVIEW_INSPECT_TOOLS,
  PREVIEW_RUN_TOOLS,
  LAUNCH_TOOLS,
  SKILL_TOOLS,
  SETUP_TOOLS,
  WEB_TOOLS,
  SWITCH_TOOLS,
  ASK_USER_TOOLS
);

const PLAN_TOOLS = unionTools(
  READ_TOOLS,
  PREVIEW_INSPECT_TOOLS,
  PREVIEW_RUN_TOOLS,
  LAUNCH_TOOLS,
  SUBTASK_TOOLS,
  SKILL_TOOLS,
  SETUP_TOOLS,
  WEB_TOOLS,
  SWITCH_TOOLS,
  ASK_USER_TOOLS
);

const ASK_TOOLS = unionTools(
  READ_TOOLS,
  PREVIEW_INSPECT_TOOLS,
  SKILL_TOOLS,
  ["docker_image_lookup"] as const,
  WEB_TOOLS,
  SWITCH_TOOLS,
  ASK_USER_TOOLS
);

const MULTITASK_TOOLS = unionTools(
  READ_TOOLS,
  WRITE_TOOLS,
  PREVIEW_INSPECT_TOOLS,
  PREVIEW_RUN_TOOLS,
  LAUNCH_TOOLS,
  SUBTASK_TOOLS,
  SKILL_TOOLS,
  SETUP_TOOLS,
  WEB_TOOLS,
  SWITCH_TOOLS,
  ASK_USER_TOOLS
);

export const MODE_TOOL_ALLOWLIST: Record<AgentMode, ReadonlySet<string>> = {
  agent: AGENT_TOOLS,
  plan: PLAN_TOOLS,
  debug: AGENT_TOOLS,
  ask: ASK_TOOLS,
  multitask: MULTITASK_TOOLS,
  auto: AGENT_TOOLS
};

export function parseAgentMode(raw: unknown): AgentMode | null {
  if (typeof raw !== "string") {
    return null;
  }
  const v = raw.trim().toLowerCase();
  if (v === "build") {
    return "agent";
  }
  if ((AGENT_MODE_IDS as readonly string[]).includes(v)) {
    return v as AgentMode;
  }
  return null;
}

export function resolveChatAgentMode(raw: unknown): AgentMode {
  return parseAgentMode(raw) ?? "ask";
}

export function effectiveToolMode(mode: AgentMode): AgentMode {
  return mode === "auto" ? "agent" : mode;
}

export function isToolAllowedForMode(options: {
  agentMode: AgentMode;
  toolName: string;
}): boolean {
  const mode = effectiveToolMode(options.agentMode);
  return MODE_TOOL_ALLOWLIST[mode].has(options.toolName);
}

export function toolDeniedMessage(options: {
  agentMode: AgentMode;
  toolName: string;
}): string {
  return `${options.toolName} is not available in ${options.agentMode} mode`;
}
