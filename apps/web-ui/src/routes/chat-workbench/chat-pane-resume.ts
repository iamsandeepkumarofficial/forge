import {
  fetchRunningTurn,
  fetchSessionMessages,
  consumeTurnStream,
  type UiChatMessage
} from "../../lib/chat-agent.js";
import {
  mergeSessionMessagesForUi,
  type ToolPart
} from "../../lib/tool-display.js";
import type { ComposerAgentMode } from "../../components/chat-composer-shared.js";
import { applyTurnStreamEvent } from "./chat-pane-stream-events.js";

export function streamUrlForTurn(sessionId: string, turnId: string): string {
  return `/api/sessions/${encodeURIComponent(sessionId)}/turns/${encodeURIComponent(turnId)}/stream`;
}

export async function findRunningChatTurn(
  sessionId: string
): Promise<{ id: string; workflowId: string; status: string } | null> {
  return fetchRunningTurn(sessionId);
}

export type ResumeTurnControllers = {
  streamAbortRef: { current: AbortController | null };
  setStatus: (s: "ready" | "submitted" | "streaming" | "error") => void;
  setActiveTurnId: (id: string | null) => void;
  setStreamingText: React.Dispatch<React.SetStateAction<string>>;
  setStreamingReasoning: React.Dispatch<React.SetStateAction<string>>;
  setLiveToolParts: React.Dispatch<React.SetStateAction<ToolPart[]>>;
  setError: (e: Error | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<UiChatMessage[]>>;
  onAppliedMode?: (mode: ComposerAgentMode) => void;
};

export function handleResumeStreamEvent(
  options: ResumeTurnControllers & {
    eventType: string;
    payload: Record<string, unknown>;
    sessionId: string;
  }
): void {
  applyTurnStreamEvent({
    eventType: options.eventType,
    payload: options.payload,
    setStreamingText: options.setStreamingText,
    setStreamingReasoning: options.setStreamingReasoning,
    setLiveToolParts: options.setLiveToolParts,
    setError: options.setError,
    onAppliedMode: options.onAppliedMode
  });
  if (
    options.eventType === "tool_result" ||
    options.eventType === "llm_finish" ||
    options.eventType === "done"
  ) {
    void fetchSessionMessages(options.sessionId)
      .then((rows) => options.setMessages(mergeSessionMessagesForUi(rows)))
      .catch(() => undefined);
  }
}

function beginLiveResume(options: {
  controllers: ResumeTurnControllers;
  ac: AbortController;
  turnId: string;
}): void {
  const { controllers, ac, turnId } = options;
  controllers.streamAbortRef.current = ac;
  controllers.setActiveTurnId(turnId);
  controllers.setStatus("streaming");
  controllers.setError(null);
  controllers.setStreamingText("");
  controllers.setStreamingReasoning("");
  controllers.setLiveToolParts([]);
}

function endLiveResume(
  controllers: ResumeTurnControllers,
  rows?: UiChatMessage[]
): void {
  if (rows) controllers.setMessages(rows);
  controllers.setStreamingText("");
  controllers.setStreamingReasoning("");
  controllers.setLiveToolParts([]);
  controllers.setActiveTurnId(null);
  controllers.setStatus("ready");
}

export async function resumeIfRunningTurn(options: {
  sessionId: string;
  signal: AbortSignal;
  ac: AbortController;
  controllers: ResumeTurnControllers;
}): Promise<boolean> {
  const { sessionId, signal, ac, controllers } = options;
  const turn = await findRunningChatTurn(sessionId);
  if (!turn?.id) return false;
  beginLiveResume({ controllers, ac, turnId: turn.id });
  try {
    await consumeTurnStream({
      streamUrl: streamUrlForTurn(sessionId, turn.id),
      signal,
      handlers: {
        onEvent: ({ eventType, payload }) =>
          handleResumeStreamEvent({
            eventType,
            payload,
            sessionId,
            ...controllers
          })
      }
    });
    const rows = await fetchSessionMessages(sessionId);
    endLiveResume(controllers, mergeSessionMessagesForUi(rows));
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      controllers.setActiveTurnId(null);
      controllers.setStatus("ready");
      throw err;
    }
    console.warn("[chat] resume running turn failed", err);
    endLiveResume(controllers);
  } finally {
    if (controllers.streamAbortRef.current === ac) {
      controllers.streamAbortRef.current = null;
    }
  }
  return true;
}
