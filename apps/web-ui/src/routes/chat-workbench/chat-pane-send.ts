import {
  startChatTurn,
  fetchSessionMessages,
  consumeTurnStream,
  type ChatMode,
  type LlmProvider,
  type UiChatMessage
} from "../../lib/chat-agent.js";
import {
  applyLiveToolEvent,
  mergeSessionMessagesForUi,
  type ToolPart
} from "../../lib/tool-display.js";

const N_40000 = 40000;

export async function readAttachmentsAsText(files: File[]): Promise<string> {
  if (files.length === 0) return "";
  const parts: string[] = [];
  for (const file of files) {
    const text = await file.text().catch(() => "");
    const clipped =
      text.length > N_40000 ? `${text.slice(0, N_40000)}\n…[truncated]` : text;
    parts.push(`Attached file: ${file.name}\n\`\`\`\n${clipped}\n\`\`\``);
  }
  return parts.join("\n\n");
}

export async function runChatSend(options: {
  sessionId: string;
  text: string;
  provider: LlmProvider;
  model: string | undefined;
  mode: ChatMode;
  signal: AbortSignal;
  onTurnId: (turnId: string) => void;
  onEvent: (event: {
    eventType: string;
    payload: Record<string, unknown>;
  }) => void;
}): Promise<UiChatMessage[]> {
  const { sessionId, text, provider, model, mode, signal, onTurnId, onEvent } =
    options;
  const { turnId, streamUrl } = await startChatTurn(sessionId, {
    text,
    provider,
    model,
    mode
  });
  onTurnId(turnId);
  await consumeTurnStream({
    streamUrl,
    handlers: {
      onEvent: ({ eventType, payload }) => onEvent({ eventType, payload })
    },
    signal
  });
  const rows = await fetchSessionMessages(sessionId);
  return mergeSessionMessagesForUi(rows);
}

export function applyStreamToolEvent(options: {
  prev: ToolPart[];
  eventType: string;
  payload: Record<string, unknown>;
}): ToolPart[] {
  if (
    options.eventType === "tool_call" ||
    options.eventType === "tool_result"
  ) {
    return applyLiveToolEvent({
      prev: options.prev,
      eventType: options.eventType,
      payload: options.payload
    });
  }
  return options.prev;
}
