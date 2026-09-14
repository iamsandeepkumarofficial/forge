import { useEffect, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import { copySessionMessagesUntil } from "../../lib/chat-agent.js";
import { readBranchCopyState } from "./branch-chat.js";

export function useBranchCopyBoot(options: {
  sessionId: string | undefined;
  locationState: unknown;
  pathname: string;
  navigate: NavigateFunction;
  onReady: () => void;
}): {
  copying: boolean;
  copyError: string | null;
  retry: () => void;
} {
  const pending = readBranchCopyState(options.locationState);
  const sourceSessionId = pending?.sourceSessionId ?? "";
  const targetSessionId = pending?.targetSessionId ?? "";
  const untilMessageId = pending?.untilMessageId ?? "";
  const pendingKey = pending
    ? `${sourceSessionId}:${targetSessionId}:${untilMessageId}`
    : "";
  const [copyError, setCopyError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [doneKey, setDoneKey] = useState("");
  const { sessionId, pathname, navigate, onReady } = options;
  const copying = Boolean(pendingKey) && doneKey !== pendingKey && !copyError;

  useEffect(() => {
    if (!pendingKey || !sessionId) return;
    if (targetSessionId !== sessionId) return;
    if (doneKey === pendingKey) return;
    let cancelled = false;
    void copySessionMessagesUntil({
      sourceSessionId,
      targetSessionId,
      untilMessageId
    })
      .then(() => {
        if (cancelled) return;
        setDoneKey(pendingKey);
        void navigate(pathname, { replace: true, state: {} });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCopyError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [
    sessionId,
    sourceSessionId,
    targetSessionId,
    untilMessageId,
    pendingKey,
    doneKey,
    attempt,
    pathname,
    navigate
  ]);

  useEffect(() => {
    if (!sessionId || copying || copyError) return;
    onReady();
  }, [sessionId, copying, copyError, onReady]);

  return {
    copying,
    copyError,
    retry: () => {
      setCopyError(null);
      setDoneKey("");
      setAttempt((n) => n + 1);
    }
  };
}
