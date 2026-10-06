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
import { PlanTasksBar } from "./plan-tasks-bar.js";
import { RunningTerminalsBar } from "./running-terminals-bar.js";
import type { CommittedTurnStep } from "./committed-turn-step.js";
import type { PlanCardModel } from "./plan-card.js";

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
  committedSteps?: CommittedTurnStep[];
  historyLoaded?: boolean;
  status: "ready" | "submitted" | "streaming" | "error";
  error: Error | null;
  clearError: () => void;
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  canSend: boolean;
  canQueue?: boolean;
  agentMode: ComposerAgentMode;
  onAgentModeChange: (m: ComposerAgentMode) => void;
  pendingAskUser?: AskUserProposal | null;
  onSubmitAskUser?: (result: AskUserSubmitResult) => void;
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
  onBranchAssistant?: (options: {
    messageId: string;
    text: string;
  }) => void | Promise<void>;
  onRevertUserMessage?: (options: { messageId: string; text: string }) => void;
  plan?: PlanCardModel | null;
  onOpenPlan?: () => void;
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
        committedSteps={o.committedSteps}
        historyLoaded={o.historyLoaded}
        status={o.status}
        waiting={Boolean(o.pendingAskUser)}
        error={o.error}
        clearError={o.clearError}
        onPickStarter={o.setInput}
        onOpenFile={o.onOpenFile}
        sessionId={o.sessionId}
        onOpenHelp={o.onOpenHelp}
        onBranchAssistant={o.onBranchAssistant}
        onRevertUserMessage={o.onRevertUserMessage}
        plan={o.plan}
        onOpenPlan={o.onOpenPlan}
        onForceSendQueued={
          o.plan?.queuedFollowUp
            ? () => o.setInput(o.plan?.queuedFollowUp?.text ?? "")
            : undefined
        }
      />
      <ChatPaneAskUserBlock
        pendingAskUser={o.pendingAskUser}
        onSubmitAskUser={o.onSubmitAskUser}
        askUserSubmitting={o.askUserSubmitting}
      />
      <ChatComposer
        sessionId={o.sessionId}
        branchName={o.branchName}
        value={o.input}
        onChange={o.setInput}
        onSend={o.onSend}
        onStop={o.onStop}
        canSend={o.canSend}
        canQueue={o.canQueue}
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
        leading={
          <ChatPaneComposerLeading
            plan={o.plan}
            onOpenPlan={o.onOpenPlan}
            sessionId={o.sessionId}
          />
        }
      />
    </div>
  );
}

function ChatPaneAskUserBlock(props: {
  pendingAskUser?: AskUserProposal | null;
  onSubmitAskUser?: (result: AskUserSubmitResult) => void;
  askUserSubmitting?: boolean;
}) {
  if (!props.pendingAskUser) return null;
  return (
    <>
      <div
        role="status"
        className="shrink-0 border-t bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
      >
        Waiting on you
      </div>
      {props.onSubmitAskUser ? (
        <div className="shrink-0 border-t px-3 py-2">
          <AskUserPrompt
            proposal={props.pendingAskUser}
            onSubmit={props.onSubmitAskUser}
            submitting={props.askUserSubmitting}
          />
        </div>
      ) : null}
    </>
  );
}

function ChatPaneComposerLeading(props: {
  plan?: PlanCardModel | null;
  onOpenPlan?: () => void;
  sessionId: string;
}) {
  return (
    <div className="absolute inset-x-3 bottom-full z-10 flex flex-col gap-0">
      {props.plan && props.plan.tasks.length > 0 ? (
        <PlanTasksBar plan={props.plan} onOpenPlan={props.onOpenPlan} />
      ) : null}
      <RunningTerminalsBar sessionId={props.sessionId} />
    </div>
  );
}
