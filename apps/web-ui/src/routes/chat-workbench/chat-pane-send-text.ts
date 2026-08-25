import type {
  ChatMode,
  LlmProvider,
  UiChatMessage
} from "../../lib/chat-agent.js";
import type { ComposerAgentMode } from "../../components/chat-composer-shared.js";
import { parseComposerMode } from "../../lib/mode-switch.js";
import type { ToolPart } from "../../lib/tool-display.js";
import {
  applyStreamToolEvent,
  readAttachmentsAsText,
  runChatSend
} from "./chat-pane-send.js";

function maybeApplySwitchMode(options: {
  eventType: string;
  payload: Record<string, unknown>;
  onAppliedMode?: (mode: ComposerAgentMode) => void;
}): void {
  if (options.eventType !== "tool_result") return;
  if (options.payload.toolName !== "switch_mode") return;
  const meta =
    options.payload.metadata && typeof options.payload.metadata === "object"
      ? (options.payload.metadata as Record<string, unknown>)
      : null;
  if (meta?.applied !== true) return;
  const mode = parseComposerMode(meta.mode ?? meta.target);
  if (mode) options.onAppliedMode?.(mode);
}

function handleStreamEvent(options: {
  eventType: string;
  payload: Record<string, unknown>;
  setStreamingText: React.Dispatch<React.SetStateAction<string>>;
  setLiveToolParts: React.Dispatch<React.SetStateAction<ToolPart[]>>;
  setError: (e: Error | null) => void;
  onAppliedMode?: (mode: ComposerAgentMode) => void;
}) {
  const {
    eventType,
    payload,
    setStreamingText,
    setLiveToolParts,
    setError,
    onAppliedMode
  } = options;
  if (eventType === "text_delta" && typeof payload.text === "string") {
    setStreamingText((prev) => prev + payload.text);
    return;
  }
  if (eventType === "tool_call" || eventType === "tool_result") {
    setLiveToolParts((prev) =>
      applyStreamToolEvent({ prev, eventType, payload })
    );
    maybeApplySwitchMode({ eventType, payload, onAppliedMode });
    return;
  }
  if (eventType === "turn_status" || eventType === "done") {
    const st = String(payload.status ?? "");
    if (st === "failed" && typeof payload.error === "string") {
      setError(new Error(payload.error));
    }
  }
}

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
        handleStreamEvent({
          eventType,
          payload,
          setStreamingText: options.setStreamingText,
          setLiveToolParts: options.setLiveToolParts,
          setError: options.setError,
          onAppliedMode: options.onAppliedMode
        });
      }
    });
    options.setMessages(rows);
    options.setStreamingText("");
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
