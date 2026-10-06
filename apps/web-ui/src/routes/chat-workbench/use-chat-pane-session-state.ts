import { useEffect, useRef, useState } from "react";
import type { ToolPart } from "../../lib/tool-display.js";
import {
  snapshotLiveStep,
  type CommittedTurnStep
} from "./committed-turn-step.js";

type SessionStatus = "ready" | "submitted" | "streaming" | "error";

export function useChatPaneSessionState() {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [status, setStatus] = useState<SessionStatus>("ready");
  const [error, setError] = useState<Error | null>(null);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [streamingReasoning, setStreamingReasoning] = useState("");
  const [liveToolParts, setLiveToolParts] = useState<ToolPart[]>([]);
  const [committedSteps, setCommittedSteps] = useState<CommittedTurnStep[]>([]);
  const streamAbortRef = useRef<AbortController | null>(null);
  const streamingTextRef = useRef(streamingText);
  const streamingReasoningRef = useRef(streamingReasoning);
  const liveToolPartsRef = useRef(liveToolParts);
  useEffect(() => {
    streamingTextRef.current = streamingText;
    streamingReasoningRef.current = streamingReasoning;
    liveToolPartsRef.current = liveToolParts;
  }, [streamingText, streamingReasoning, liveToolParts]);
  const flushLiveStep = () => {
    const snap = snapshotLiveStep({
      text: streamingTextRef.current,
      reasoning: streamingReasoningRef.current,
      tools: liveToolPartsRef.current
    });
    if (snap) setCommittedSteps((steps) => [...steps, snap]);
    setStreamingText("");
    setStreamingReasoning("");
    setLiveToolParts([]);
  };
  const clearLiveTurn = () => {
    setCommittedSteps([]);
    setStreamingText("");
    setStreamingReasoning("");
    setLiveToolParts([]);
  };
  const isStreaming = status === "submitted" || status === "streaming";
  const hasContent = input.trim().length > 0 || attachments.length > 0;
  const canSend = hasContent && (status === "ready" || status === "error");
  const canQueue = hasContent && status === "streaming";
  return {
    input,
    setInput,
    attachments,
    setAttachments,
    status,
    setStatus,
    error,
    setError,
    activeTurnId,
    setActiveTurnId,
    streamingText,
    setStreamingText,
    streamingReasoning,
    setStreamingReasoning,
    liveToolParts,
    setLiveToolParts,
    committedSteps,
    flushLiveStep,
    clearLiveTurn,
    streamAbortRef,
    isStreaming,
    canSend,
    canQueue
  };
}
