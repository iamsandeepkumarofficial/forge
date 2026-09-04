import { tool, type Tool } from "ai";
import { z } from "zod";
import {
  AGENT_MODE_IDS,
  formatToolDescription,
  parseAgentMode,
  type AgentMode
} from "@forge/core";

export function switchModeTool(currentMode: AgentMode): Record<string, Tool> {
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
  
  value: z.string().optional()
});

export function askUserTool(): Record<string, Tool> {
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

