import { modeSwitchContinueMessage } from "../../lib/mode-switch.js";
import { useChatPaneModel } from "./use-chat-pane-model.js";
import { useChatPaneSession } from "./use-chat-pane-session.js";
import { usePendingModeSwitch } from "./use-pending-mode-switch.js";
import { estimateConversationTokens } from "./chat-pane-tokens.js";
import { ChatPaneView } from "./chat-pane-view.js";

type ChatPaneProps = {
  sessionId: string;
  projectId: string;
  chatId: string;
  sessionKind: "ticket" | "workbench";
  initialPrompt?: string;
};

function lastUserMessageIndex(messages: { role: string }[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return i;
  }
  return -1;
}

export function ChatPane(props: ChatPaneProps) {
  const { sessionId, projectId, chatId, sessionKind, initialPrompt } = props;
  const model = useChatPaneModel();
  const session = useChatPaneSession({
    sessionId,
    projectId,
    chatId,
    initialPrompt,
    provider: model.provider,
    activeModel: model.activeModel,
    autoModel: model.autoModel,
    mode: model.mode,
    onAppliedMode: model.setAgentMode
  });
  const modeSwitch = usePendingModeSwitch({
    messages: session.messages,
    liveToolParts: session.liveToolParts,
    onConfirm: (mode) => {
      model.setAgentMode(mode);
      void session.sendText(modeSwitchContinueMessage(mode), { mode });
    }
  });
  const conversationTokens = estimateConversationTokens({
    messages: session.messages,
    streamingText: session.streamingText,
    liveToolParts: session.liveToolParts
  });
  return (
    <ChatPaneView
      sessionId={sessionId}
      projectId={projectId}
      chatId={chatId}
      sessionKind={sessionKind}
      scrollerRef={session.scrollerRef}
      stickToBottomRef={session.stickToBottomRef}
      messages={session.messages}
      isStreaming={session.isStreaming}
      streamingText={session.streamingText}
      liveToolParts={session.liveToolParts}
      status={session.status}
      error={session.error}
      clearError={session.clearError}
      lastUserIndex={lastUserMessageIndex(session.messages)}
      input={session.input}
      setInput={session.setInput}
      onSend={() => void session.handleSend()}
      onStop={() => void session.handleStop()}
      canSend={session.canSend}
      agentMode={model.agentMode}
      onAgentModeChange={model.setAgentMode}
      pendingModeSwitch={modeSwitch.pending?.target ?? null}
      modeSwitchRemainingSeconds={modeSwitch.remainingSeconds}
      onConfirmModeSwitch={modeSwitch.onConfirmModeSwitch}
      onDismissModeSwitch={modeSwitch.onDismissModeSwitch}
      provider={model.provider}
      model={model.activeModel}
      autoModel={model.autoModel}
      onAutoModelChange={model.setAutoModel}
      modelsByProvider={model.modelsByProvider}
      modelsLoading={model.modelsLoading}
      onModelSelect={model.onModelSelect}
      conversationTokens={conversationTokens}
      maxContextTokens={model.contextWindow}
      maxOutputTokens={model.maxOutputTokens}
      attachments={session.attachments}
      onAttachFiles={(files) =>
        session.setAttachments((prev) => [...prev, ...files])
      }
      onRemoveAttachment={(index) =>
        session.setAttachments((prev) => prev.filter((_, i) => i !== index))
      }
    />
  );
}
