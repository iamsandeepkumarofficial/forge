import { useEffect, useState } from "react";
import {
  fetchSessionMessages,
  type UiChatMessage
} from "../../lib/chat-agent.js";
import { mergeSessionMessagesForUi } from "../../lib/tool-display.js";

export function useChatHistory(sessionId: string) {
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(sessionId);
  if (activeSessionId !== sessionId) {
    setActiveSessionId(sessionId);
    setHistoryLoaded(false);
    setMessages([]);
  }
  useEffect(() => {
    let cancelled = false;
    void fetchSessionMessages(sessionId)
      .then((rows) => {
        if (!cancelled) {
          setMessages(mergeSessionMessagesForUi(rows));
          setHistoryLoaded(true);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn("[chat] load history failed", err);
          setHistoryLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);
  return { messages, setMessages, historyLoaded };
}
