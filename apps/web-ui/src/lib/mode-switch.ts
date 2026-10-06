import type { ComposerAgentMode } from "../components/chat-composer-shared.js";
import { toolPartName, type ToolPart } from "./tool-display.js";
import type { UiChatMessage } from "./chat-agent.js";

export const MODE_SWITCH_TIMEOUT_MS = 45_000;

const MS_PER_SECOND = 1000;

export const MODE_SWITCH_TIMEOUT_SECONDS =
  MODE_SWITCH_TIMEOUT_MS / MS_PER_SECOND;

const MODE_IDS: readonly ComposerAgentMode[] = [
  "agent",
  "plan",
  "debug",
  "ask",
  "auto"
];

export type ModeSwitchProposal = {
  toolCallId: string | null;
  target: ComposerAgentMode;
};

export function parseComposerMode(raw: unknown): ComposerAgentMode | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (v === "build" || v === "multitask") return "agent";
  return (MODE_IDS as readonly string[]).includes(v)
    ? (v as ComposerAgentMode)
    : null;
}

export function modeSwitchContinueMessage(mode: ComposerAgentMode): string {
  const label = `${mode.charAt(0)!.toUpperCase()}${mode.slice(1)}`;
  return `Approved — continue in ${label} mode.`;
}

function proposalFromPart(part: ToolPart): ModeSwitchProposal | null {
  if (toolPartName(part) !== "switch_mode") return null;
  const meta = part.metadata;
  if (!meta || meta.needsConfirmation !== true || meta.applied === true) {
    return null;
  }
  const target = parseComposerMode(meta.target);
  if (!target) return null;
  return {
    toolCallId: typeof part.toolCallId === "string" ? part.toolCallId : null,
    target
  };
}

function appliedFromPart(part: ToolPart): ComposerAgentMode | null {
  if (toolPartName(part) !== "switch_mode") return null;
  const meta = part.metadata;
  if (!meta || meta.applied !== true) return null;
  return parseComposerMode(meta.mode ?? meta.target);
}

function collectToolParts(
  messages: UiChatMessage[],
  liveToolParts: ToolPart[]
): ToolPart[] {
  const parts: ToolPart[] = [...liveToolParts];
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      if (!part || typeof part !== "object") continue;
      const p = part as ToolPart;
      if (typeof p.type === "string" && p.type.includes("tool")) {
        parts.push(p);
      }
    }
  }
  return parts;
}

export function findPendingModeSwitch(options: {
  messages: UiChatMessage[];
  liveToolParts: ToolPart[];
  dismissedIds: ReadonlySet<string>;
}): ModeSwitchProposal | null {
  const parts = collectToolParts(options.messages, options.liveToolParts);
  for (let i = parts.length - 1; i >= 0; i--) {
    const proposal = proposalFromPart(parts[i]!);
    if (!proposal) continue;
    const key = proposal.toolCallId ?? `anon:${proposal.target}`;
    if (options.dismissedIds.has(key)) continue;
    return proposal;
  }
  return null;
}

export function findAppliedModeSwitch(options: {
  messages: UiChatMessage[];
  liveToolParts: ToolPart[];
}): ComposerAgentMode | null {
  const parts = collectToolParts(options.messages, options.liveToolParts);
  for (let i = parts.length - 1; i >= 0; i--) {
    const mode = appliedFromPart(parts[i]!);
    if (mode) return mode;
  }
  return null;
}
