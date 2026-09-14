import { useState } from "react";
import type { UiChatMessage } from "../../lib/chat-agent.js";
import {
  toolPartsOf as toolPartsFromUnknown,
  type ToolPart
} from "../../lib/tool-display.js";
import { chatTurnActivity, liveToolName } from "./chat-turn-activity.js";
import {
  AssistantMessageActions,
  RevertChatDialog
} from "./chat-message-actions.js";
import { AssistantTurn, UserTurn } from "./chat-message-turns.js";
import { EmptyChat, TurnActivity } from "./chat-empty-state.js";
import {
  extractMessageText,
  extractRunAssistantText,
  groupTranscriptMessages,
  isPersistedMessageId,
  lastPersistedAssistantId,
  shouldShowRunActions
} from "./chat-run-actions.js";
import {
  excludeKnownToolParts,
  historyToolCallIds,
  type CommittedTurnStep
} from "./committed-turn-step.js";

export { CHAT_STARTERS } from "./chat-empty-state.js";

function extractMessageReasoning(message: UiChatMessage): string {
  return message.parts
    .filter(
      (
        p
      ): p is {
        type: string;
        text: string;
      } => p.type === "reasoning" && typeof p.text === "string"
    )
    .map((p) => p.text)
    .join("");
}

function toolPartsOf(message: UiChatMessage): ToolPart[] {
  return toolPartsFromUnknown(message.parts);
}

export type TranscriptBodyOptions = {
  messages: UiChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  streamingReasoning?: string;
  liveToolParts: ToolPart[];
  committedSteps?: CommittedTurnStep[];
  historyLoaded?: boolean;
  status: "ready" | "submitted" | "streaming" | "error";
  waiting?: boolean;
  error: Error | null;
  clearError: () => void;
  onPickStarter?: (prompt: string) => void;
  onOpenFile?: (path: string) => void;
  sessionId?: string;
  onOpenHelp?: () => void;
  onBranchAssistant?: (options: {
    messageId: string;
    text: string;
  }) => void | Promise<void>;
  onRevertUserMessage?: (options: { messageId: string; text: string }) => void;
};

function TranscriptUser(options: {
  message: UiChatMessage;
  editing: boolean;
  showUndo: boolean;
  onUndo: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: (text: string) => void;
}) {
  const m = options.message;
  return (
    <UserTurn
      text={extractMessageText(m)}
      editing={options.editing}
      showUndo={options.showUndo}
      onUndo={options.onUndo}
      onCancelEdit={options.onCancelEdit}
      onSubmitEdit={options.onSubmitEdit}
    />
  );
}

function TranscriptRun(options: {
  messages: UiChatMessage[];
  showActions: boolean;
  lastAssistantId: string | null;
  copyText: string;
  onOpenFile?: (path: string) => void;
  onBranchAssistant?: TranscriptBodyOptions["onBranchAssistant"];
}) {
  const { lastAssistantId, copyText } = options;
  return (
    <div className="group/msg space-y-4">
      {options.messages.map((m) => (
        <AssistantTurn
          key={m.id}
          text={extractMessageText(m)}
          reasoning={extractMessageReasoning(m)}
          tools={toolPartsOf(m)}
          onOpenFile={options.onOpenFile}
        />
      ))}
      {options.showActions ? (
        <AssistantMessageActions
          text={copyText}
          onBranch={
            options.onBranchAssistant && lastAssistantId
              ? () =>
                  options.onBranchAssistant?.({
                    messageId: lastAssistantId,
                    text: copyText
                  })
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

function TranscriptGroups(options: {
  messages: UiChatMessage[];
  actionsEnabled: boolean;
  isStreaming: boolean;
  waiting?: boolean;
  editingId: string | null;
  onOpenFile?: (path: string) => void;
  onBranchAssistant?: TranscriptBodyOptions["onBranchAssistant"];
  onRevertUserMessage?: TranscriptBodyOptions["onRevertUserMessage"];
  setEditingId: (id: string | null) => void;
  setPendingRevert: (next: { messageId: string; text: string }) => void;
}) {
  const groups = groupTranscriptMessages(options.messages);
  const lastIndex = groups.length - 1;
  return (
    <>
      {groups.map((group, index) => {
        if (group.kind === "user") {
          const m = group.message;
          return (
            <TranscriptUser
              key={m.id}
              message={m}
              editing={options.editingId === m.id}
              showUndo={
                options.actionsEnabled &&
                isPersistedMessageId(m.id) &&
                Boolean(options.onRevertUserMessage)
              }
              onUndo={() => options.setEditingId(m.id)}
              onCancelEdit={() => options.setEditingId(null)}
              onSubmitEdit={(text) =>
                options.setPendingRevert({ messageId: m.id, text })
              }
            />
          );
        }
        const lastAssistantId = lastPersistedAssistantId(group.messages);
        return (
          <TranscriptRun
            key={lastAssistantId ?? group.messages[0]?.id ?? `run-${index}`}
            messages={group.messages}
            lastAssistantId={lastAssistantId}
            copyText={extractRunAssistantText(group.messages)}
            showActions={
              Boolean(lastAssistantId) &&
              shouldShowRunActions({
                isLastRun: index === lastIndex,
                isStreaming: options.isStreaming,
                waiting: options.waiting
              })
            }
            onOpenFile={options.onOpenFile}
            onBranchAssistant={options.onBranchAssistant}
          />
        );
      })}
    </>
  );
}

function TranscriptLive(options: {
  committed: CommittedTurnStep[];
  streamingText: string;
  streamingReasoning: string;
  liveTools: ToolPart[];
  onOpenFile?: (path: string) => void;
}) {
  return (
    <>
      {options.committed.map((step, i) => (
        <AssistantTurn
          key={`committed-${i}`}
          text={step.text}
          reasoning={step.reasoning}
          tools={step.tools}
          onOpenFile={options.onOpenFile}
        />
      ))}
      <AssistantTurn
        text={options.streamingText}
        reasoning={options.streamingReasoning}
        tools={options.liveTools}
        streaming
        onOpenFile={options.onOpenFile}
      />
    </>
  );
}

function liveTranscriptView(options: TranscriptBodyOptions): {
  liveTools: ToolPart[];
  committed: CommittedTurnStep[];
  showLive: boolean;
  showEmpty: boolean;
  actionsEnabled: boolean;
  streamingReasoning: string;
  historyLoaded: boolean;
} {
  const committedSteps = options.committedSteps ?? [];
  const streamingReasoning = options.streamingReasoning ?? "";
  const historyLoaded = options.historyLoaded ?? true;
  const knownIds = historyToolCallIds(options.messages);
  const liveTools = excludeKnownToolParts(options.liveToolParts, knownIds);
  const committed = committedSteps.map((step) => ({
    ...step,
    tools: excludeKnownToolParts(step.tools, knownIds)
  }));
  const showLive =
    options.isStreaming ||
    Boolean(options.streamingText) ||
    Boolean(streamingReasoning) ||
    liveTools.length > 0 ||
    committed.some(
      (step) => step.text || step.reasoning || step.tools.length > 0
    );
  return {
    liveTools,
    committed,
    showLive,
    showEmpty:
      historyLoaded &&
      options.messages.length === 0 &&
      !options.isStreaming &&
      !showLive,
    actionsEnabled:
      options.status === "ready" && !options.isStreaming && !options.waiting,
    streamingReasoning,
    historyLoaded
  };
}

function TranscriptAlerts(options: {
  error: Error | null;
  clearError: () => void;
  pendingRevert: { messageId: string; text: string } | null;
  onCancelRevert: () => void;
  onConfirmRevert: () => void;
}) {
  return (
    <>
      {options.error ? (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <span>{options.error.message}</span>
          <button onClick={() => options.clearError()} className="underline">
            dismiss
          </button>
        </div>
      ) : null}
      {options.pendingRevert ? (
        <RevertChatDialog
          onCancel={options.onCancelRevert}
          onRevert={options.onConfirmRevert}
        />
      ) : null}
    </>
  );
}

export function TranscriptBody(options: TranscriptBodyOptions) {
  const view = liveTranscriptView(options);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingRevert, setPendingRevert] = useState<{
    messageId: string;
    text: string;
  } | null>(null);
  return (
    <>
      {view.showEmpty ? (
        <EmptyChat
          onPickStarter={options.onPickStarter}
          sessionId={options.sessionId}
          onOpenHelp={options.onOpenHelp}
        />
      ) : null}
      {!view.historyLoaded && options.messages.length === 0 ? (
        <p className="px-2 py-6 text-center text-xs text-muted-foreground">
          Loading conversation…
        </p>
      ) : null}
      <TranscriptGroups
        messages={options.messages}
        actionsEnabled={view.actionsEnabled}
        isStreaming={options.isStreaming}
        waiting={options.waiting}
        editingId={editingId}
        onOpenFile={options.onOpenFile}
        onBranchAssistant={options.onBranchAssistant}
        onRevertUserMessage={options.onRevertUserMessage}
        setEditingId={setEditingId}
        setPendingRevert={setPendingRevert}
      />
      {view.showLive ? (
        <TranscriptLive
          committed={view.committed}
          streamingText={options.streamingText}
          streamingReasoning={view.streamingReasoning}
          liveTools={view.liveTools}
          onOpenFile={options.onOpenFile}
        />
      ) : null}
      <TurnActivity
        label={chatTurnActivity({
          status: options.status,
          waiting: options.waiting,
          toolName: liveToolName(view.liveTools)
        })}
      />
      <TranscriptAlerts
        error={options.error}
        clearError={options.clearError}
        pendingRevert={pendingRevert}
        onCancelRevert={() => setPendingRevert(null)}
        onConfirmRevert={() => {
          const next = pendingRevert;
          setPendingRevert(null);
          setEditingId(null);
          if (next) options.onRevertUserMessage?.(next);
        }}
      />
    </>
  );
}
