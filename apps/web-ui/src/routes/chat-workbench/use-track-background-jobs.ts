import { useEffect, useRef } from "react";
import type { UiChatMessage } from "../../lib/chat-agent.js";
import { listTerminalJobs } from "../../lib/session-terminal.js";
import { toolPartsOf, type ToolPart } from "../../lib/tool-display.js";
import { trackTerminalsFromToolParts } from "./tracked-terminals.js";

function historyToolParts(messages: UiChatMessage[]): ToolPart[] {
  const parts: ToolPart[] = [];
  for (const message of messages) {
    parts.push(...toolPartsOf(message.parts));
  }
  return parts;
}

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
    const parts = historyToolParts(messages);
    let cancelled = false;
    void (async () => {
      let liveJobNames: Set<string> | undefined;
      try {
        const jobs = await listTerminalJobs(sessionId);
        liveJobNames = new Set(
          jobs.filter((job) => job.running).map((job) => job.name)
        );
      } catch {
        liveJobNames = undefined;
      }
      if (cancelled) return;
      trackTerminalsFromToolParts({
        sessionId,
        parts,
        liveJobNames
      });
      historyScannedFor.current = sessionId;
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, historyLoaded, messages]);

  useEffect(() => {
    if (liveToolParts.length === 0) return;
    trackTerminalsFromToolParts({
      sessionId,
      parts: liveToolParts,
      openTabs: true
    });
  }, [sessionId, liveToolParts]);
}
