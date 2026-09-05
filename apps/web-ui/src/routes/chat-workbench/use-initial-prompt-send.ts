import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export function useInitialPromptSend(options: {
  initialPrompt?: string;
  historyLoaded: boolean;
  status: string;
  messageCount: number;

  sendEvenIfNotEmpty?: boolean;

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
