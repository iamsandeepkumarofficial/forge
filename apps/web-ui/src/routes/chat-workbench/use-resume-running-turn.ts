import { useEffect, useRef, useState } from "react";
import {
  resumeIfRunningTurn,
  type ResumeTurnControllers
} from "./chat-pane-resume.js";

export type UseResumeRunningTurnOptions = ResumeTurnControllers & {
  sessionId: string;
  historyLoaded: boolean;
  status: string;
};

export function useResumeRunningTurn(options: UseResumeRunningTurnOptions): {
  resumeChecked: boolean;
} {
  const { sessionId, historyLoaded, status } = options;
  const [checkedFor, setCheckedFor] = useState<string | null>(null);
  const controllersRef = useRef(options);
  const statusRef = useRef(status);
  const resumeChecked =
    checkedFor === sessionId || (historyLoaded && status !== "ready");

  useEffect(() => {
    controllersRef.current = options;
    statusRef.current = status;
  });

  useEffect(() => {
    if (!historyLoaded) return;
    if (statusRef.current !== "ready") return;
    let cancelled = false;
    const ac = new AbortController();
    void resumeIfRunningTurn({
      sessionId,
      signal: ac.signal,
      ac,
      controllers: controllersRef.current
    })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setCheckedFor(sessionId);
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [sessionId, historyLoaded]);

  return { resumeChecked };
}
