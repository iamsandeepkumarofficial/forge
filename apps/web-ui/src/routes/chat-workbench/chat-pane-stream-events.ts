import type { ComposerAgentMode } from "../../components/chat-composer-shared.js";
import { parseComposerMode } from "../../lib/mode-switch.js";
import type { ToolPart } from "../../lib/tool-display.js";
import { applyStreamToolEvent } from "./chat-pane-send.js";

function maybeApplySwitchMode(options: {
  eventType: string;
  payload: Record<string, unknown>;
  onAppliedMode?: (mode: ComposerAgentMode) => void;
}): void {
  if (options.eventType !== "tool_result") return;
  if (options.payload.toolName !== "switch_mode") return;
  const meta =
    options.payload.metadata && typeof options.payload.metadata === "object"
      ? (options.payload.metadata as Record<string, unknown>)
      : null;
  if (meta?.applied !== true) return;
  const mode = parseComposerMode(meta.mode ?? meta.target);
  if (mode) options.onAppliedMode?.(mode);
}

export function applyTurnStreamEvent(options: {
  eventType: string;
  payload: Record<string, unknown>;
  setStreamingText: React.Dispatch<React.SetStateAction<string>>;
  setStreamingReasoning: React.Dispatch<React.SetStateAction<string>>;
  setLiveToolParts: React.Dispatch<React.SetStateAction<ToolPart[]>>;
  setError: (e: Error | null) => void;
  onAppliedMode?: (mode: ComposerAgentMode) => void;
}): void {
  const {
    eventType,
    payload,
    setStreamingText,
    setStreamingReasoning,
    setLiveToolParts,
    setError,
    onAppliedMode
  } = options;
  if (eventType === "llm_start") {
    setStreamingText("");
    setStreamingReasoning("");
    setLiveToolParts([]);
    return;
  }
  if (eventType === "text_delta" && typeof payload.text === "string") {
    setStreamingText((prev) => prev + payload.text);
    return;
  }
  if (eventType === "reasoning_delta" && typeof payload.text === "string") {
    setStreamingReasoning((prev) => prev + payload.text);
    return;
  }
  if (eventType === "tool_call" || eventType === "tool_result") {
    setLiveToolParts((prev) =>
      applyStreamToolEvent({ prev, eventType, payload })
    );
    maybeApplySwitchMode({ eventType, payload, onAppliedMode });
    return;
  }
  if (eventType === "turn_status" || eventType === "done") {
    const st = String(payload.status ?? "");
    if (st === "failed" && typeof payload.error === "string") {
      setError(new Error(payload.error));
    }
  }
}
