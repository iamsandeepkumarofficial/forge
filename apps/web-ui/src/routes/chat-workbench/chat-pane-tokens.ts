import type { UiChatMessage } from "../../lib/chat-agent.js";

const CHARS_PER_TOKEN = 4;
const PART_VALUE_KEYS = [
  "text",
  "args",
  "input",
  "output",
  "result",
  "errorText"
] as const;

function stringifyPartValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function charsFromPart(part: Record<string, unknown>): number {
  let chars = 0;
  for (const key of PART_VALUE_KEYS) {
    if (!(key in part)) continue;
    chars += stringifyPartValue(part[key]).length;
  }
  return chars;
}

export function estimateConversationTokens(options: {
  messages: UiChatMessage[];
  streamingText: string;
  liveToolParts?: Array<Record<string, unknown>>;
}): number {
  let chars = options.streamingText.length;
  for (const message of options.messages) {
    for (const part of message.parts) {
      if (!part || typeof part !== "object") continue;
      chars += charsFromPart(part);
    }
  }
  for (const part of options.liveToolParts ?? []) {
    if (!part || typeof part !== "object") continue;
    chars += charsFromPart(part);
  }
  return Math.round(chars / CHARS_PER_TOKEN);
}
