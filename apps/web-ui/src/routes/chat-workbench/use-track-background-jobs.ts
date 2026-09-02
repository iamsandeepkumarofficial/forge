import { useEffect, useRef } from "react";
import type { UiChatMessage } from "../../lib/chat-agent.js";
import { toolPartsOf, type ToolPart } from "../../lib/tool-display.js";
import { trackTerminalsFromToolParts } from "./tracked-terminals.js";

function historyToolParts(messages: UiChatMessage[]): ToolPart[] {
  const parts: ToolPart[] = [];
  for (const message of messages) {
    parts.push(...toolPartsOf(message.parts));
  }
  return parts;
}

/**
 * Auto-subscribe background jobs + preview_start apps from chat tool parts.
 * History is scanned once after fetch completes; live parts update on each change.
 */
export function useTrackBackgroundJobs(options: {
  sessionId: string;
  messages: UiChatMessage[];
  historyLoaded: boolean;
  liveToolParts: ToolPart[];
}): void {
  const { sessionId, messages, historyLoaded, liveToolParts } = options;
  const historyScannedFor = useRef<string | null>(null);

  useEffect(() => {
    if (historyScannedFor.current !== sessionId) {
      historyScannedFor.current = null;
    }
  }, [sessionId]);

  useEffect(() => {
    if (!historyLoaded) return;
    if (historyScannedFor.current === sessionId) return;
    historyScannedFor.current = sessionId;
    trackTerminalsFromToolParts(sessionId, historyToolParts(messages));
  }, [sessionId, historyLoaded, messages]);

  useEffect(() => {
    if (liveToolParts.length === 0) return;
    trackTerminalsFromToolParts(sessionId, liveToolParts);
  }, [sessionId, liveToolParts]);
}
