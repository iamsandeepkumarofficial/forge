import { type RefObject } from "react";
import {
  TranscriptBody,
  type TranscriptBodyOptions
} from "./chat-transcript.js";
import { looksLikePlan } from "./chat-message-turns.js";
import type { PlanCardModel } from "./plan-card.js";
import { PlanChatSection } from "./plan-panel.js";

const N_80 = 80;

export { CHAT_STARTERS } from "./chat-transcript.js";
export { looksLikePlan };

export type ChatMessageListOptions = TranscriptBodyOptions & {
  scrollerRef: RefObject<HTMLDivElement | null>;
  stickToBottomRef: RefObject<boolean>;
  sessionKind: "ticket" | "workbench";
  projectId: string;
  chatId: string;
  plan?: PlanCardModel | null;
  onOpenPlan?: () => void;
  onForceSendQueued?: () => void;
};

function syncStickToBottom(
  el: HTMLDivElement,
  stickToBottomRef: RefObject<boolean>
): void {
  const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
  stickToBottomRef.current = distance < N_80;
}

export function ChatMessageList(options: ChatMessageListOptions) {
  const {
    scrollerRef,
    stickToBottomRef,
    sessionKind: _sessionKind,
    projectId: _projectId,
    chatId: _chatId,
    messages,
    isStreaming,
    streamingText,
    streamingReasoning,
    liveToolParts,
    committedSteps,
    historyLoaded,
    status,
    waiting,
    error,
    clearError,
    onPickStarter,
    onOpenFile,
    sessionId,
    onOpenHelp,
    onBranchAssistant,
    onRevertUserMessage,
    plan,
    onOpenPlan,
    onForceSendQueued
  } = options;
  return (
    <div
      ref={scrollerRef}
      className="flex-1 overflow-y-auto"
      onScroll={(e) => syncStickToBottom(e.currentTarget, stickToBottomRef)}
    >
      <div className="space-y-4 px-4 py-4">
        <TranscriptBody
          messages={messages}
          isStreaming={isStreaming}
          streamingText={streamingText}
          streamingReasoning={streamingReasoning}
          liveToolParts={liveToolParts}
          committedSteps={committedSteps}
          historyLoaded={historyLoaded}
          status={status}
          waiting={waiting}
          error={error}
          clearError={clearError}
          onPickStarter={onPickStarter}
          onOpenFile={onOpenFile}
          sessionId={sessionId}
          onOpenHelp={onOpenHelp}
          onBranchAssistant={onBranchAssistant}
          onRevertUserMessage={onRevertUserMessage}
        />
        {plan ? (
          <PlanChatSection
            plan={plan}
            onOpenInPanel={onOpenPlan}
            onForceSend={onForceSendQueued}
          />
        ) : null}
      </div>
    </div>
  );
}
