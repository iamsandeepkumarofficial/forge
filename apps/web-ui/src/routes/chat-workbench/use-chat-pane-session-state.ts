import { useRef, useState } from "react";
import type { ToolPart } from "../../lib/tool-display.js";

type SessionStatus = "ready" | "submitted" | "streaming" | "error";

export function useChatPaneSessionState() {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [status, setStatus] = useState<SessionStatus>("ready");
  const [error, setError] = useState<Error | null>(null);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [liveToolParts, setLiveToolParts] = useState<ToolPart[]>([]);
  const streamAbortRef = useRef<AbortController | null>(null);
  const isStreaming = status === "submitted" || status === "streaming";
  const canSend =
    (input.trim().length > 0 || attachments.length > 0) && status === "ready";
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
    liveToolParts,
    setLiveToolParts,
    streamAbortRef,
    isStreaming,
    canSend
  };
}
