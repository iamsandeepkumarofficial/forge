import type {
  ChatMode,
  LlmProvider,
  UiChatMessage
} from "../../lib/chat-agent.js";
import type { ComposerAgentMode } from "../../components/chat-composer-shared.js";
import type { ToolPart } from "../../lib/tool-display.js";
import { readAttachmentsAsText, runChatSend } from "./chat-pane-send.js";
import { applyTurnStreamEvent } from "./chat-pane-stream-events.js";

export type SendChatPaneTextOptions = {
  raw: string;
  attachments: File[];
  status: string;
  sessionId: string;
  provider: LlmProvider;
  activeModel: string;
  autoModel: boolean;
  mode: ChatMode;
  setInput: (v: string) => void;
  setAttachments: (v: File[]) => void;
  setError: (e: Error | null) => void;
  setStreamingText: React.Dispatch<React.SetStateAction<string>>;
  setStreamingReasoning: React.Dispatch<React.SetStateAction<string>>;
  setLiveToolParts: React.Dispatch<React.SetStateAction<ToolPart[]>>;
  setStatus: (s: "ready" | "submitted" | "streaming" | "error") => void;
  setMessages: React.Dispatch<React.SetStateAction<UiChatMessage[]>>;
  setActiveTurnId: (id: string | null) => void;
  stickToBottomRef: { current: boolean };
  streamAbortRef: { current: AbortController | null };
  onAppliedMode?: (mode: ComposerAgentMode) => void;
};

function beginOptimisticSend(options: SendChatPaneTextOptions, text: string) {
  options.setInput("");
  options.setAttachments([]);
  options.setError(null);
  options.setStreamingText("");
  options.setStreamingReasoning("");
  options.setLiveToolParts([]);
  options.setStatus("submitted");
  options.stickToBottomRef.current = true;
  options.setMessages((prev) => [
    ...prev,
    {
      id: `local-user-${Date.now()}`,
      role: "user",
      parts: [{ type: "text", text }]
    }
  ]);
}

export async function sendChatPaneText(
  options: SendChatPaneTextOptions
): Promise<void> {
  const attachmentBlock = await readAttachmentsAsText(options.attachments);
  const text = [options.raw.trim(), attachmentBlock]
    .filter(Boolean)
    .join("\n\n");
  if (!text || options.status !== "ready") return;
  beginOptimisticSend(options, text);
  const ac = new AbortController();
  options.streamAbortRef.current = ac;
  try {
    options.setStatus("streaming");
    const rows = await runChatSend({
      sessionId: options.sessionId,
      text,
      provider: options.provider,
      model: options.autoModel
        ? undefined
        : options.activeModel.trim() || undefined,
      mode: options.mode,
      signal: ac.signal,
      onTurnId: options.setActiveTurnId,
      onEvent: ({ eventType, payload }) => {
        applyTurnStreamEvent({
          eventType,
          payload,
          setStreamingText: options.setStreamingText,
          setStreamingReasoning: options.setStreamingReasoning,
          setLiveToolParts: options.setLiveToolParts,
          setError: options.setError,
          onAppliedMode: options.onAppliedMode
        });
      }
    });
    options.setMessages(rows);
    options.setStreamingText("");
    options.setStreamingReasoning("");
    options.setLiveToolParts([]);
    options.setActiveTurnId(null);
    options.setStatus("ready");
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      options.setStatus("ready");
      options.setActiveTurnId(null);
      return;
    }
    options.setError(err instanceof Error ? err : new Error(String(err)));
    options.setStatus("error");
    options.setActiveTurnId(null);
    setTimeout(() => options.setStatus("ready"), 0);
  } finally {
    options.streamAbortRef.current = null;
  }
}
