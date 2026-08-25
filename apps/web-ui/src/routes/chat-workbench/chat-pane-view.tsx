import { ChatComposer } from "../../components/chat-composer.js";
import type { ComposerAgentMode } from "../../components/chat-composer.js";
import type { ModelsByProvider } from "../../components/chat-composer-shared.js";
import type { LlmProvider, UiChatMessage } from "../../lib/chat-agent.js";
import type { ToolPart } from "../../lib/tool-display.js";
import { ChatMessageList } from "./chat-message-list.js";

export type ChatPaneViewProps = {
  sessionId: string;
  projectId: string;
  chatId: string;
  sessionKind: "ticket" | "workbench";
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  stickToBottomRef: React.RefObject<boolean>;
  messages: UiChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  liveToolParts: ToolPart[];
  status: "ready" | "submitted" | "streaming" | "error";
  error: Error | null;
  clearError: () => void;
  lastUserIndex: number;
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  canSend: boolean;
  agentMode: ComposerAgentMode;
  onAgentModeChange: (m: ComposerAgentMode) => void;
  pendingModeSwitch?: ComposerAgentMode | null;
  modeSwitchRemainingSeconds?: number;
  onConfirmModeSwitch?: () => void;
  onDismissModeSwitch?: () => void;
  provider: LlmProvider;
  model: string;
  autoModel: boolean;
  onAutoModelChange: (auto: boolean) => void;
  modelsByProvider: ModelsByProvider;
  modelsLoading: boolean;
  onModelSelect: (provider: LlmProvider, model: string) => void;
  conversationTokens: number;
  maxContextTokens: number | null;
  maxOutputTokens: number | null;
  attachments: File[];
  onAttachFiles: (files: File[]) => void;
  onRemoveAttachment: (index: number) => void;
};

export function ChatPaneView(props: ChatPaneViewProps) {
  const o = props;
  return (
    <div className="flex h-full flex-col">
      <ChatMessageList
        scrollerRef={o.scrollerRef}
        stickToBottomRef={o.stickToBottomRef}
        sessionKind={o.sessionKind}
        projectId={o.projectId}
        chatId={o.chatId}
        messages={o.messages}
        isStreaming={o.isStreaming}
        streamingText={o.streamingText}
        liveToolParts={o.liveToolParts}
        status={o.status}
        error={o.error}
        clearError={o.clearError}
        lastUserIndex={o.lastUserIndex}
      />
      <ChatComposer
        sessionId={o.sessionId}
        value={o.input}
        onChange={o.setInput}
        onSend={o.onSend}
        onStop={o.onStop}
        canSend={o.canSend}
        status={o.status}
        agentMode={o.agentMode}
        onAgentModeChange={o.onAgentModeChange}
        pendingModeSwitch={o.pendingModeSwitch}
        modeSwitchRemainingSeconds={o.modeSwitchRemainingSeconds}
        onConfirmModeSwitch={o.onConfirmModeSwitch}
        onDismissModeSwitch={o.onDismissModeSwitch}
        provider={o.provider}
        model={o.model}
        autoModel={o.autoModel}
        onAutoModelChange={o.onAutoModelChange}
        modelsByProvider={o.modelsByProvider}
        modelsLoading={o.modelsLoading}
        onModelSelect={o.onModelSelect}
        conversationTokens={o.conversationTokens}
        maxContextTokens={o.maxContextTokens}
        maxOutputTokens={o.maxOutputTokens}
        attachments={o.attachments}
        onAttachFiles={o.onAttachFiles}
        onRemoveAttachment={o.onRemoveAttachment}
      />
    </div>
  );
}
