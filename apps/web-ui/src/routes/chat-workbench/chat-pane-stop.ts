import { fetchSessionMessages, cancelChatTurn } from "../../lib/chat-agent.js";
import {
  mergeSessionMessagesForUi,
  type ToolPart
} from "../../lib/tool-display.js";
import type { UiChatMessage } from "../../lib/chat-agent.js";

export async function stopChatTurn(options: {
  sessionId: string;
  activeTurnId: string | null;
  streamAbortRef: { current: AbortController | null };
  setActiveTurnId: (id: string | null) => void;
  setStatus: (s: "ready" | "submitted" | "streaming" | "error") => void;
  setMessages: React.Dispatch<React.SetStateAction<UiChatMessage[]>>;
  setStreamingText: (v: string) => void;
  setLiveToolParts: (v: ToolPart[]) => void;
}) {
  options.streamAbortRef.current?.abort();
  if (options.activeTurnId) {
    try {
      await cancelChatTurn(options.sessionId, options.activeTurnId);
    } catch (err) {
      console.warn("[chat] cancel failed", err);
    }
  }
  options.setActiveTurnId(null);
  options.setStatus("ready");
  try {
    const rows = await fetchSessionMessages(options.sessionId);
    options.setMessages(mergeSessionMessagesForUi(rows));
  } catch {
    void 0;
  }
  options.setStreamingText("");
  options.setLiveToolParts([]);
}
