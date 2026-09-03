import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Send a one-shot initial prompt once history is ready.
 * When clearStatePath is set, replaces location state so refresh does not re-send.
 * Omit clearStatePath for embedded drawers that should not navigate.
 */
export function useInitialPromptSend(options: {
  initialPrompt?: string;
  historyLoaded: boolean;
  status: string;
  messageCount: number;
  /** When true, send even if the chat already has messages (CTA re-open). */
  sendEvenIfNotEmpty?: boolean;
  /** Path used to clear location.state after send. Omit to skip navigation. */
  clearStatePath?: string;
  sendText: (raw: string) => void;
}) {
  const {
    initialPrompt,
    historyLoaded,
    status,
    messageCount,
    sendEvenIfNotEmpty,
    clearStatePath,
    sendText
  } = options;
  const navigate = useNavigate();
  const sentRef = useRef(false);
  useEffect(() => {
    if (!initialPrompt?.trim()) return;
    if (!historyLoaded || status !== "ready") return;
    if (sentRef.current) return;
    if (!sendEvenIfNotEmpty && messageCount > 0) return;
    sentRef.current = true;
    if (clearStatePath) {
      void navigate(clearStatePath, {
        replace: true,
        state: {}
      });
    }
    sendText(initialPrompt);
  }, [
    initialPrompt,
    historyLoaded,
    status,
    messageCount,
    sendEvenIfNotEmpty,
    clearStatePath,
    navigate,
    sendText
  ]);
}
