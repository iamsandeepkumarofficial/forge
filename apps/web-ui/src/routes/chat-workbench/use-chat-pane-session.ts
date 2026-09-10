import type { ChatMode, LlmProvider } from "../../lib/chat-agent.js";
import type { ComposerAgentMode } from "../../components/chat-composer-shared.js";
import { sendChatPaneText } from "./chat-pane-send-text.js";
import { stopChatTurn } from "./chat-pane-stop.js";
import { useChatHistory } from "./use-chat-history.js";
import { useInitialPromptSend } from "./use-initial-prompt-send.js";
import { useChatPaneSessionState } from "./use-chat-pane-session-state.js";
import { useResumeRunningTurn } from "./use-resume-running-turn.js";
import { useScrollStick } from "./use-scroll-stick.js";

type SessionOptions = {
  sessionId: string;
  projectId: string;
  chatId: string;
  workspaceId?: string;
  skipInitialPromptNavigate?: boolean;
  sendInitialPromptEvenIfNotEmpty?: boolean;
  initialPrompt?: string;
  provider: LlmProvider;
  activeModel: string;
  autoModel: boolean;
  mode: ChatMode;
  onAppliedMode?: (mode: ComposerAgentMode) => void;
};

function clearStatePathFor(options: SessionOptions): string | undefined {
  if (options.skipInitialPromptNavigate) return undefined;
  if (options.projectId) {
    return `/projects/${options.projectId}/chats/${options.chatId}`;
  }
  if (options.workspaceId) {
    return `/workspaces/${options.workspaceId}/chats/${options.chatId}`;
  }
  return undefined;
}

function useSessionTransport(o: SessionOptions) {
  const s = useChatPaneSessionState();
  const history = useChatHistory(o.sessionId);
  const scroll = useScrollStick({
    messageCount: history.messages.length,
    streamingText: s.streamingText,
    streamingReasoning: s.streamingReasoning,
    isStreaming: s.isStreaming,
    toolPartCount: s.liveToolParts.length
  });
  const { resumeChecked } = useResumeRunningTurn({
    sessionId: o.sessionId,
    historyLoaded: history.historyLoaded,
    status: s.status,
    streamAbortRef: s.streamAbortRef,
    setStatus: s.setStatus,
    setActiveTurnId: s.setActiveTurnId,
    setStreamingText: s.setStreamingText,
    setStreamingReasoning: s.setStreamingReasoning,
    setLiveToolParts: s.setLiveToolParts,
    setError: s.setError,
    setMessages: history.setMessages,
    onAppliedMode: o.onAppliedMode
  });
  return { s, history, scroll, resumeChecked };
}

export function useChatPaneSession(options: SessionOptions) {
  const o = options;
  const { s, history, scroll, resumeChecked } = useSessionTransport(o);
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
      setStreamingReasoning: s.setStreamingReasoning,
      setLiveToolParts: s.setLiveToolParts,
      setStatus: s.setStatus,
      setMessages: history.setMessages,
      setActiveTurnId: s.setActiveTurnId,
      stickToBottomRef: scroll.stickToBottomRef,
      streamAbortRef: s.streamAbortRef,
      onAppliedMode: o.onAppliedMode
    });
  useInitialPromptSend({
    initialPrompt: o.initialPrompt,
    historyLoaded: history.historyLoaded && resumeChecked,
    status: s.status,
    messageCount: history.messages.length,
    sendEvenIfNotEmpty: o.sendInitialPromptEvenIfNotEmpty,
    clearStatePath: clearStatePathFor(o),
    sendText: (raw) => {
      void sendText(raw);
    }
  });
  return {
    ...s,
    messages: history.messages,
    historyLoaded: history.historyLoaded,
    clearError: () => s.setError(null),
    scrollerRef: scroll.scrollerRef,
    stickToBottomRef: scroll.stickToBottomRef,
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
        setStreamingReasoning: s.setStreamingReasoning,
        setLiveToolParts: s.setLiveToolParts
      }) as Promise<void>
  };
}
