import type { ChatMode, LlmProvider } from "../../lib/chat-agent.js";
import type { ComposerAgentMode } from "../../components/chat-composer-shared.js";
import { sendChatPaneText } from "./chat-pane-send-text.js";
import { stopChatTurn } from "./chat-pane-stop.js";
import { useChatHistory } from "./use-chat-history.js";
import { useInitialPromptSend } from "./use-initial-prompt-send.js";
import { useChatPaneSessionState } from "./use-chat-pane-session-state.js";
import { useScrollStick } from "./use-scroll-stick.js";

type SessionOptions = {
  sessionId: string;
  projectId: string;
  chatId: string;
  /** When set (workspace chats), used for initial-prompt state clear path. */
  workspaceId?: string;
  /** Skip location replace (embedded drawer). */
  skipInitialPromptNavigate?: boolean;
  /** Send CTA prompt even when the chat already has messages. */
  sendInitialPromptEvenIfNotEmpty?: boolean;
  initialPrompt?: string;
  provider: LlmProvider;
  activeModel: string;
  autoModel: boolean;
  mode: ChatMode;
  onAppliedMode?: (mode: ComposerAgentMode) => void;
};

export function useChatPaneSession(options: SessionOptions) {
  const o = options;
  const s = useChatPaneSessionState();
  const history = useChatHistory(o.sessionId);
  const { scrollerRef, stickToBottomRef } = useScrollStick({
    messageCount: history.messages.length,
    streamingText: s.streamingText,
    isStreaming: s.isStreaming,
    toolPartCount: s.liveToolParts.length
  });
  const sendText = (raw: string, sendOpts?: { mode?: ChatMode }) =>
    sendChatPaneText({
      raw,
      attachments: s.attachments,
      status: s.status,
      sessionId: o.sessionId,
      provider: o.provider,
      activeModel: o.activeModel,
      autoModel: o.autoModel,
      mode: sendOpts?.mode ?? o.mode,
      setInput: s.setInput,
      setAttachments: s.setAttachments,
      setError: s.setError,
      setStreamingText: s.setStreamingText,
      setLiveToolParts: s.setLiveToolParts,
      setStatus: s.setStatus,
      setMessages: history.setMessages,
      setActiveTurnId: s.setActiveTurnId,
      stickToBottomRef,
      streamAbortRef: s.streamAbortRef,
      onAppliedMode: o.onAppliedMode
    });
  useInitialPromptSend({
    initialPrompt: o.initialPrompt,
    historyLoaded: history.historyLoaded,
    status: s.status,
    messageCount: history.messages.length,
    sendEvenIfNotEmpty: o.sendInitialPromptEvenIfNotEmpty,
    clearStatePath: o.skipInitialPromptNavigate
      ? undefined
      : o.projectId
        ? `/projects/${o.projectId}/chats/${o.chatId}`
        : o.workspaceId
          ? `/workspaces/${o.workspaceId}/chats/${o.chatId}`
          : undefined,
    sendText: (raw) => {
      void sendText(raw);
    }
  });
  return {
    input: s.input,
    setInput: s.setInput,
    attachments: s.attachments,
    setAttachments: s.setAttachments,
    messages: history.messages,
    historyLoaded: history.historyLoaded,
    status: s.status,
    error: s.error,
    clearError: () => s.setError(null),
    streamingText: s.streamingText,
    liveToolParts: s.liveToolParts,
    scrollerRef,
    stickToBottomRef,
    isStreaming: s.isStreaming,
    canSend: s.canSend,
    sendText,
    handleSend: async () => {
      if (!s.canSend) return;
      await sendText(s.input);
    },
    handleStop: () =>
      stopChatTurn({
        sessionId: o.sessionId,
        activeTurnId: s.activeTurnId,
        streamAbortRef: s.streamAbortRef,
        setActiveTurnId: s.setActiveTurnId,
        setStatus: s.setStatus,
        setMessages: history.setMessages,
        setStreamingText: s.setStreamingText,
        setLiveToolParts: s.setLiveToolParts
      })
  };
}
