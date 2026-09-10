import { useEffect, useRef, useState } from "react";
import { onAgentPrompt } from "./preview-comment-bus.js";
import { modeSwitchContinueMessage } from "../../lib/mode-switch.js";
import { askUserFormReply, type AskUserProposal } from "../../lib/ask-user.js";
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
  onOpenHelp?: () => void;
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
    const saved = await applyAskUserFormToWorkspaceParams({
      workspaceId,
      fields: proposal.fields,
      values: result.values
    });
    return askUserFormReply({
      fields: proposal.fields,
      values: result.values,
      savedParamKeys: saved
    });
  }
  return result.text;
}

function submitAskUserFromPane(options: {
  workspaceId?: string;
  proposal: AskUserProposal;
  result: AskUserSubmitResult;
  dismissAskUser: (proposal: AskUserProposal) => void;
  sendText: (text: string) => void;
  setAskUserSubmitting: (v: boolean) => void;
}) {
  const {
    workspaceId,
    proposal,
    result,
    dismissAskUser,
    sendText,
    setAskUserSubmitting
  } = options;
  void (async () => {
    setAskUserSubmitting(true);
    try {
      const text = await submitAskUserAnswer({ workspaceId, proposal, result });
      dismissAskUser(proposal);
      void sendText(text);
    } catch (err) {
      dismissAskUser(proposal);
      void sendText(
        `${result.text}\n\n(Note: failed to save parameters to store: ${
          err instanceof Error ? err.message : String(err)
        })`
      );
    } finally {
      setAskUserSubmitting(false);
    }
  })();
}

function useChatPaneSideEffects(options: {
  session: ReturnType<typeof useChatPaneSession>;
  askUserPending: boolean;
  onTurnStatus?: ChatPaneProps["onTurnStatus"];
}) {
  const { session, askUserPending, onTurnStatus } = options;
  const sendTextRef = useRef(session.sendText);
  const stopRef = useRef(session.handleStop);
  useEffect(() => {
    sendTextRef.current = session.sendText;
    stopRef.current = session.handleStop;
  }, [session.sendText, session.handleStop]);
  useEffect(
    () =>
      onAgentPrompt((msg) => {
        void (async () => {
          if (msg.replaceRunning) {
            await stopRef.current();
          }
          await sendTextRef.current(msg.text);
        })();
      }),
    []
  );
  useEffect(() => {
    onTurnStatus?.(
      deriveTurnStatus({
        status: session.status,
        pendingAskUser: askUserPending
      })
    );
  }, [onTurnStatus, session.status, askUserPending]);
}

function useChatPaneControllers(props: ChatPaneProps) {
  const {
    sessionId,
    projectId,
    chatId,
    workspaceId,
    skipInitialPromptNavigate,
    sendInitialPromptEvenIfNotEmpty,
    initialPrompt,
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
  useTrackBackgroundJobs({
    sessionId,
    messages: session.messages,
    historyLoaded: session.historyLoaded,
    liveToolParts: session.liveToolParts
  });
  const askUser = usePendingAskUser({
    sessionId,
    messages: session.messages,
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
  useChatPaneSideEffects({
    session,
    askUserPending: showAskUser,
    onTurnStatus
  });
  const handleSubmitAskUser = (result: AskUserSubmitResult) => {
    const proposal = askUser.pending;
    if (!proposal) return;
    submitAskUserFromPane({
      workspaceId,
      proposal,
      result,
      dismissAskUser: askUser.dismissAskUser,
      sendText: session.sendText,
      setAskUserSubmitting
    });
  };
  return {
    model,
    session,
    askUser,
    askUserSubmitting,
    handleSubmitAskUser,
    showAskUser,
    modeSwitch,
    conversationTokens
  };
}

function ChatPaneWired(options: {
  props: ChatPaneProps;
  c: ReturnType<typeof useChatPaneControllers>;
}) {
  const { props, c } = options;
  return (
    <ChatPaneView
      sessionId={props.sessionId}
      projectId={props.projectId}
      chatId={props.chatId}
      sessionKind={props.sessionKind}
      branchName={props.branchName}
      scrollerRef={c.session.scrollerRef}
      stickToBottomRef={c.session.stickToBottomRef}
      messages={c.session.messages}
      isStreaming={c.session.isStreaming}
      streamingText={c.session.streamingText}
      streamingReasoning={c.session.streamingReasoning}
      liveToolParts={c.session.liveToolParts}
      status={c.session.status}
      error={c.session.error}
      clearError={c.session.clearError}
      input={c.session.input}
      setInput={c.session.setInput}
      onSend={() => void c.session.handleSend()}
      onStop={() => void c.session.handleStop()}
      canSend={c.session.canSend}
      agentMode={c.model.agentMode}
      onAgentModeChange={c.model.setAgentMode}
      pendingAskUser={c.askUser.pending}
      onSubmitAskUser={c.handleSubmitAskUser}
      onDismissAskUser={c.askUser.onDismissAskUser}
      askUserSubmitting={c.askUserSubmitting}
      pendingModeSwitch={
        c.showAskUser ? null : (c.modeSwitch.pending?.target ?? null)
      }
      modeSwitchRemainingSeconds={c.modeSwitch.remainingSeconds}
      onConfirmModeSwitch={c.modeSwitch.onConfirmModeSwitch}
      onDismissModeSwitch={c.modeSwitch.onDismissModeSwitch}
      provider={c.model.provider}
      model={c.model.activeModel}
      autoModel={c.model.autoModel}
      onAutoModelChange={c.model.setAutoModel}
      modelsByProvider={c.model.modelsByProvider}
      modelsLoading={c.model.modelsLoading}
      onModelSelect={c.model.onModelSelect}
      conversationTokens={c.conversationTokens}
      maxContextTokens={c.model.contextWindow}
      maxOutputTokens={c.model.maxOutputTokens}
      attachments={c.session.attachments}
      onAttachFiles={(files) =>
        c.session.setAttachments((prev) => [...prev, ...files])
      }
      onRemoveAttachment={(index) =>
        c.session.setAttachments((prev) => prev.filter((_, i) => i !== index))
      }
      onOpenFile={props.onOpenFile}
      onOpenHelp={props.onOpenHelp}
    />
  );
}

export function ChatPane(props: ChatPaneProps) {
  const c = useChatPaneControllers(props);
  return <ChatPaneWired props={props} c={c} />;
}
