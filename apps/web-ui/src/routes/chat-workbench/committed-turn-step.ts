import type { UiChatMessage } from "../../lib/chat-agent.js";
import { toolPartsOf, type ToolPart } from "../../lib/tool-display.js";

export type CommittedTurnStep = {
  text: string;
  reasoning: string;
  tools: ToolPart[];
};

export function snapshotLiveStep(options: {
  text: string;
  reasoning: string;
  tools: ToolPart[];
}): CommittedTurnStep | null {
  if (!options.text && !options.reasoning && options.tools.length === 0) {
    return null;
  }
  return {
    text: options.text,
    reasoning: options.reasoning,
    tools: options.tools
  };
}

export function historyToolCallIds(messages: UiChatMessage[]): Set<string> {
  const ids = new Set<string>();
  for (const message of messages) {
    for (const part of toolPartsOf(message.parts)) {
      if (part.toolCallId) ids.add(part.toolCallId);
    }
  }
  return ids;
}

export function excludeKnownToolParts(
  parts: ToolPart[],
  knownIds: Set<string>
): ToolPart[] {
  return parts.filter((p) => !p.toolCallId || !knownIds.has(p.toolCallId));
}
