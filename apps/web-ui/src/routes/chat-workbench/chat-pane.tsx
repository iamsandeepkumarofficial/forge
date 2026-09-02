import { useEffect, useRef, useState } from "react";
import { onPreviewChatMessage } from "./preview-comment-bus.js";
import { modeSwitchContinueMessage } from "../../lib/mode-switch.js";
import {
  askUserFormReply,
  type AskUserProposal
} from "../../lib/ask-user.js";
import { applyAskUserFormToWorkspaceParams } from "../../lib/ask-user-apply-params.js";
import type { AskUserSubmitResult } from "../../components/ask-user-prompt.js";
import { useChatPaneModel } from "./use-chat-pane-model.js";
import { useChatPaneSession } from "./use-chat-pane-session.js";
import { usePendingModeSwitch } from "./use-pending-mode-switch.js";
import { usePendingAskUser } from "./use-pending-ask-user.js";
import { useTrackBackgroundJobs } from "./use-track-background-jobs.js";
import { estimateConversationTokens } from "./chat-pane-tokens.js";
import { ChatPaneView } from "./chat-pane-view.js";
import type { WorkbenchTurnStatus } from "./types.js";
import { deriveTurnStatus } from "./workbench-status.js";

type ChatPaneProps = {
  sessionId: string;
  projectId: string;
  chatId: string;
  sessionKind: "ticket" | "workbench";
  workspaceId?: string;
  branchName?: string;
  skipInitialPromptNavigate?: boolean;
  sendInitialPromptEvenIfNotEmpty?: boolean;
  initialPrompt?: string;
  onOpenFile?: (path: string) => void;
  onTurnStatus?: (status: WorkbenchTurnStatus) => void;
};

async function submitAskUserAnswer(options: {
  workspaceId?: string;
  proposal: AskUserProposal;
  result: AskUserSubmitResult;
}): Promise<string> {
  const { workspaceId, proposal, result } = options;
  if (
    workspaceId &&
    proposal.kind === "form" &&
    result.values &&
    proposal.fields.length > 0
  ) {
    const saved = await applyAskUserFormToWorkspaceParams(
      workspaceId,
      proposal.fields,
      result.values
    );
    return askUserFormReply(proposal.fields, result.values, {
      savedParamKeys: saved
    });
  }
  return result.text;
}

export function ChatPane(props: ChatPaneProps) {
  const {
    sessionId,
    projectId,
    chatId,
    sessionKind,
    workspaceId,
    branchName,
    skipInitialPromptNavigate,
    sendInitialPromptEvenIfNotEmpty,
    initialPrompt,
    onOpenFile,
    onTurnStatus
  } = props;
  const model = useChatPaneModel();
  const session = useChatPaneSession({
    sessionId,
    projectId,
    chatId,
    workspaceId,
    skipInitialPromptNavigate,
    sendInitialPromptEvenIfNotEmpty,
    initialPrompt,
    provider: model.provider,
    activeModel: model.activeModel,
    autoModel: model.autoModel,
    mode: model.mode,
    onAppliedMode: model.setAgentMode
  });
  const askUser = usePendingAskUser({
    sessionId,
    messages: session.messages,
    liveToolParts: session.liveToolParts
  });
  useTrackBackgroundJobs({
    sessionId,
    messages: session.messages,
    historyLoaded: session.historyLoaded,
    liveToolParts: session.liveToolParts
  });
  const [askUserSubmitting, setAskUserSubmitting] = useState(false);
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
  const showAskUser = Boolean(askUser.pending);
  const sendTextRef = useRef(session.sendText);
  sendTextRef.current = session.sendText;
  useEffect(() => onPreviewChatMessage((text) => void sendTextRef.current(text)), []);
  useEffect(() => {
    onTurnStatus?.(
      deriveTurnStatus({
        status: session.status,
        pendingAskUser: showAskUser
      })
    );
  }, [onTurnStatus, session.status, showAskUser]);

  const handleSubmitAskUser = (result: AskUserSubmitResult) => {
    const proposal = askUser.pending;
    if (!proposal) return;
    void (async () => {
      setAskUserSubmitting(true);
      try {
        const text = await submitAskUserAnswer({
          workspaceId,
          proposal,
          result
        });
        askUser.dismissAskUser(proposal);
        void session.sendText(text);
      } catch (err) {
        askUser.dismissAskUser(proposal);
        void session.sendText(
          `${result.text}\n\n(Note: failed to save parameters to store: ${
            err instanceof Error ? err.message : String(err)
          })`
        );
      } finally {
        setAskUserSubmitting(false);
      }
    })();
  };

  return (
    <ChatPaneView
      sessionId={sessionId}
      projectId={projectId}
      chatId={chatId}
      sessionKind={sessionKind}
      branchName={branchName}
      scrollerRef={session.scrollerRef}
      stickToBottomRef={session.stickToBottomRef}
      messages={session.messages}
      isStreaming={session.isStreaming}
      streamingText={session.streamingText}
      liveToolParts={session.liveToolParts}
      status={session.status}
      error={session.error}
      clearError={session.clearError}
      input={session.input}
      setInput={session.setInput}
      onSend={() => void session.handleSend()}
      onStop={() => void session.handleStop()}
      canSend={session.canSend}
      agentMode={model.agentMode}
      onAgentModeChange={model.setAgentMode}
      pendingAskUser={askUser.pending}
      onSubmitAskUser={handleSubmitAskUser}
      onDismissAskUser={askUser.onDismissAskUser}
      askUserSubmitting={askUserSubmitting}
      pendingModeSwitch={
        showAskUser ? null : (modeSwitch.pending?.target ?? null)
      }
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
      onOpenFile={onOpenFile}
    />
  );
}
