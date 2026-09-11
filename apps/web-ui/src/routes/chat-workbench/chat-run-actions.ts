import type { UiChatMessage } from "../../lib/chat-agent.js";

export function isPersistedMessageId(id: string): boolean {
  return Boolean(id) && !id.startsWith("local-");
}

export type TranscriptGroup =
  | { kind: "user"; message: UiChatMessage }
  | { kind: "run"; messages: UiChatMessage[] };

export function groupTranscriptMessages(
  messages: UiChatMessage[]
): TranscriptGroup[] {
  const groups: TranscriptGroup[] = [];
  let run: UiChatMessage[] = [];
  const flushRun = () => {
    if (run.length === 0) return;
    groups.push({ kind: "run", messages: run });
    run = [];
  };
  for (const message of messages) {
    if (message.role === "user") {
      flushRun();
      groups.push({ kind: "user", message });
      continue;
    }
    run.push(message);
  }
  flushRun();
  return groups;
}

export function lastPersistedAssistantId(
  messages: Array<{ id: string; role: string }>
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]!;
    if (message.role === "assistant" && isPersistedMessageId(message.id)) {
      return message.id;
    }
  }
  return null;
}

export function shouldShowRunActions(options: {
  isLastRun: boolean;
  isStreaming: boolean;
  waiting?: boolean;
}): boolean {
  if (options.isStreaming || options.waiting) return !options.isLastRun;
  return true;
}

export function extractMessageText(message: UiChatMessage): string {
  return message.parts
    .filter(
      (
        p
      ): p is {
        type: string;
        text: string;
      } => p.type === "text" && typeof p.text === "string"
    )
    .map((p) => p.text)
    .join("");
}

export function extractRunAssistantText(messages: UiChatMessage[]): string {
  return messages
    .filter((message) => message.role === "assistant")
    .map((message) => extractMessageText(message).trim())
    .filter(Boolean)
    .join("\n\n");
}
