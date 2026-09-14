import { tool, type Tool } from "ai";
import {
  formatToolDescription,
  parseAgentMode,
  type AgentMode
} from "@forge/core";
import {
  askUserInputSchema,
  switchModeInputSchema,
  type AskUserInput
} from "./schemas.js";
import type { ToolResult } from "./types.js";

export type { AskUserInput };

export function switchModeTool(currentMode: AgentMode): Record<string, Tool> {
  return {
    switch_mode: tool({
      description: formatToolDescription("switch_mode"),
      inputSchema: switchModeInputSchema,
      execute: async (input) => executeSwitchMode({ currentMode, input })
    })
  };
}

export function askUserTool(): Record<string, Tool> {
  return {
    ask_user: tool({
      description: formatToolDescription("ask_user"),
      inputSchema: askUserInputSchema,
      execute: async (input) => executeAskUser(input)
    })
  };
}

export function executeAskUser(input: AskUserInput): ToolResult {
  const kind =
    input.kind === "form" ? "form" : input.kind === "mcq" ? "mcq" : null;
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (!kind || !prompt) {
    return {
      success: false,
      output: "ask_user requires kind (mcq|form) and a non-empty prompt."
    };
  }
  if (kind === "mcq") return executeAskUserMcq(prompt, input);
  return executeAskUserForm(prompt, input);
}

function executeAskUserMcq(prompt: string, input: AskUserInput): ToolResult {
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

function executeAskUserForm(prompt: string, input: AskUserInput): ToolResult {
  const fields = (input.fields ?? [])
    .filter((f) => f?.id?.trim() && f?.label?.trim())
    .map((f) => ({
      id: f.id.trim(),
      label: f.label.trim(),
      ...(f.secret === true || f.type === "secret" ? { secret: true } : {}),
      ...(typeof f.placeholder === "string" && f.placeholder.trim()
        ? { placeholder: f.placeholder.trim() }
        : {}),
      ...(typeof f.value === "string" ? { value: f.value } : {}),
      ...(typeof f.group === "string" && f.group.trim()
        ? { group: f.group.trim() }
        : {}),
      ...(f.type === "text" || f.type === "secret" || f.type === "boolean"
        ? { type: f.type }
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
}): ToolResult {
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
