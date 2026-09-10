import { ChatComposer } from "../../components/chat-composer.js";
import type { ComposerAgentMode } from "../../components/chat-composer.js";
import {
  AskUserPrompt,
  type AskUserSubmitResult
} from "../../components/ask-user-prompt.js";
import type { ModelsByProvider } from "../../components/chat-composer-shared.js";
import type { AskUserProposal } from "../../lib/ask-user.js";
import type { LlmProvider, UiChatMessage } from "../../lib/chat-agent.js";
import type { ToolPart } from "../../lib/tool-display.js";
import { ChatMessageList } from "./chat-message-list.js";
import { RunningTerminalsBar } from "./running-terminals-bar.js";

export type ChatPaneViewProps = {
  sessionId: string;
  projectId: string;
  chatId: string;
  sessionKind: "ticket" | "workbench";
  branchName?: string;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  stickToBottomRef: React.RefObject<boolean>;
  messages: UiChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  streamingReasoning?: string;
  liveToolParts: ToolPart[];
  status: "ready" | "submitted" | "streaming" | "error";
  error: Error | null;
  clearError: () => void;
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  canSend: boolean;
  agentMode: ComposerAgentMode;
  onAgentModeChange: (m: ComposerAgentMode) => void;
  pendingAskUser?: AskUserProposal | null;
  onSubmitAskUser?: (result: AskUserSubmitResult) => void;
  onDismissAskUser?: () => void;
  askUserSubmitting?: boolean;
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
  onOpenFile?: (path: string) => void;
  onOpenHelp?: () => void;
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
        streamingReasoning={o.streamingReasoning}
        liveToolParts={o.liveToolParts}
        status={o.status}
        waiting={Boolean(o.pendingAskUser)}
        error={o.error}
        clearError={o.clearError}
        onPickStarter={o.setInput}
        onOpenFile={o.onOpenFile}
        sessionId={o.sessionId}
        onOpenHelp={o.onOpenHelp}
      />
      {o.pendingAskUser && o.onSubmitAskUser && o.onDismissAskUser ? (
        <div className="shrink-0 border-t px-3 py-2">
          <AskUserPrompt
            proposal={o.pendingAskUser}
            onSubmit={o.onSubmitAskUser}
            onDismiss={o.onDismissAskUser}
            submitting={o.askUserSubmitting}
          />
        </div>
      ) : null}
      <ChatComposer
        sessionId={o.sessionId}
        branchName={o.branchName}
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
        leading={<RunningTerminalsBar sessionId={o.sessionId} />}
      />
    </div>
  );
}
