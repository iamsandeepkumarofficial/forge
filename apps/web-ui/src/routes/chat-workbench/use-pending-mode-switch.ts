import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction
} from "react";
import type { ComposerAgentMode } from "../../components/chat-composer-shared.js";
import {
  findPendingModeSwitch,
  MODE_SWITCH_TIMEOUT_MS,
  MODE_SWITCH_TIMEOUT_SECONDS,
  type ModeSwitchProposal
} from "../../lib/mode-switch.js";
import type { ToolPart } from "../../lib/tool-display.js";
import type { UiChatMessage } from "../../lib/chat-agent.js";

const MS_PER_SECOND = 1000;
const MODE_SWITCH_TICK_MS = MS_PER_SECOND;

function proposalKey(
  toolCallId: string | null,
  target: ComposerAgentMode
): string {
  return toolCallId ?? `anon:${target}`;
}

function remainingSecondsForSession(options: {
  startedAt: number;
  nowMs: number;
}): number {
  const elapsed = options.nowMs - options.startedAt;
  const leftMs = MODE_SWITCH_TIMEOUT_MS - elapsed;
  return Math.min(
    MODE_SWITCH_TIMEOUT_SECONDS,
    Math.max(0, Math.ceil(leftMs / MS_PER_SECOND))
  );
}

function useModeSwitchCountdown(pendingKey: string | null): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!pendingKey) return;
    const startedAt = Date.now();
    const tick = () => {
      setSeconds(remainingSecondsForSession({ startedAt, nowMs: Date.now() }));
    };
    const immediateId = window.setTimeout(tick, 0);
    const intervalId = window.setInterval(tick, MODE_SWITCH_TICK_MS);
    return () => {
      window.clearTimeout(immediateId);
      window.clearInterval(intervalId);
    };
  }, [pendingKey]);
  return pendingKey ? seconds : 0;
}

function useAutoDismissModeSwitch(
  pendingKey: string | null,
  setDismissedIds: Dispatch<SetStateAction<Set<string>>>
): void {
  useEffect(() => {
    if (!pendingKey) return;
    const timeoutId = window.setTimeout(() => {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.add(pendingKey);
        return next;
      });
    }, MODE_SWITCH_TIMEOUT_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [pendingKey, setDismissedIds]);
}

export function usePendingModeSwitch(options: {
  messages: UiChatMessage[];
  liveToolParts: ToolPart[];
  onConfirm: (mode: ComposerAgentMode) => void;
}): {
  pending: ModeSwitchProposal | null;
  remainingSeconds: number;
  onConfirmModeSwitch: () => void;
  onDismissModeSwitch: () => void;
} {
  const { messages, liveToolParts, onConfirm } = options;
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(
    () => new Set()
  );
  const pending = useMemo(
    () =>
      findPendingModeSwitch({
        messages,
        liveToolParts,
        dismissedIds
      }),
    [messages, liveToolParts, dismissedIds]
  );
  const pendingKey = pending
    ? proposalKey(pending.toolCallId, pending.target)
    : null;
  const remainingSeconds = useModeSwitchCountdown(pendingKey);
  useAutoDismissModeSwitch(pendingKey, setDismissedIds);
  const dismiss = (proposal: ModeSwitchProposal) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(proposalKey(proposal.toolCallId, proposal.target));
      return next;
    });
  };
  return {
    pending,
    remainingSeconds,
    onConfirmModeSwitch: () => {
      if (!pending) return;
      onConfirm(pending.target);
      dismiss(pending);
    },
    onDismissModeSwitch: () => {
      if (!pending) return;
      dismiss(pending);
    }
  };
}
