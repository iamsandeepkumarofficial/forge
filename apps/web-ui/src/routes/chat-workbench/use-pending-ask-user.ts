import { useEffect, useMemo, useState } from "react";
import {
  askUserProposalKey,
  findPendingAskUser,
  type AskUserProposal
} from "../../lib/ask-user.js";
import type { ToolPart } from "../../lib/tool-display.js";
import type { UiChatMessage } from "../../lib/chat-agent.js";

const STORAGE_PREFIX = "forge:ask-user-dismissed:";

function loadDismissed(sessionId: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${sessionId}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function persistDismissed(sessionId: string, ids: Set<string>): void {
  try {
    sessionStorage.setItem(
      `${STORAGE_PREFIX}${sessionId}`,
      JSON.stringify([...ids])
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function usePendingAskUser(options: {
  sessionId: string;
  messages: UiChatMessage[];
  liveToolParts: ToolPart[];
}): {
  pending: AskUserProposal | null;
  onDismissAskUser: () => void;
  dismissAskUser: (proposal: AskUserProposal) => void;
} {
  const { sessionId, messages, liveToolParts } = options;
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() =>
    loadDismissed(sessionId)
  );
  useEffect(() => {
    setDismissedIds(loadDismissed(sessionId));
  }, [sessionId]);
  const pending = useMemo(
    () =>
      findPendingAskUser({
        messages,
        liveToolParts,
        dismissedIds
      }),
    [messages, liveToolParts, dismissedIds]
  );
  const dismissAskUser = (proposal: AskUserProposal) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(askUserProposalKey(proposal));
      persistDismissed(sessionId, next);
      return next;
    });
  };
  return {
    pending,
    onDismissAskUser: () => {
      if (!pending) return;
      dismissAskUser(pending);
    },
    dismissAskUser
  };
}
