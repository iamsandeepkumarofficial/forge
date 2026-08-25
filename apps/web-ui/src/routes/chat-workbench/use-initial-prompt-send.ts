import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export function useInitialPromptSend(options: {
  initialPrompt?: string;
  historyLoaded: boolean;
  status: string;
  messageCount: number;
  projectId: string;
  chatId: string;
  sendText: (raw: string) => void;
}) {
  const {
    initialPrompt,
    historyLoaded,
    status,
    messageCount,
    projectId,
    chatId,
    sendText
  } = options;
  const navigate = useNavigate();
  const sentRef = useRef(false);
  useEffect(() => {
    if (!initialPrompt?.trim()) return;
    if (!historyLoaded || status !== "ready") return;
    if (sentRef.current) return;
    sentRef.current = true;
    void navigate(`/projects/${projectId}/chats/${chatId}`, {
      replace: true,
      state: {}
    });
    if (messageCount === 0) sendText(initialPrompt);
  }, [
    initialPrompt,
    historyLoaded,
    status,
    messageCount,
    projectId,
    chatId,
    navigate,
    sendText
  ]);
}
