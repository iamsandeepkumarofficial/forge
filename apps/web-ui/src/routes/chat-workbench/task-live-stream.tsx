import { useEffect, useState } from "react";
import { consumeTurnStream } from "../../lib/chat-agent.js";
import { streamUrlForTurn } from "./chat-pane-resume.js";

const PREVIEW_MAX = 280;

export function TaskLiveStream(props: {
  sessionId: string;
  streamTurnId: string;
  active: boolean;
}) {
  const { sessionId, streamTurnId, active } = props;
  const [text, setText] = useState("");
  const [toolName, setToolName] = useState<string | null>(null);
  const [seenTurn, setSeenTurn] = useState(streamTurnId);
  if (seenTurn !== streamTurnId) {
    setSeenTurn(streamTurnId);
    setText("");
    setToolName(null);
  }

  useEffect(() => {
    if (!active || !sessionId || !streamTurnId) {
      return;
    }
    const ac = new AbortController();
    void consumeTurnStream({
      streamUrl: streamUrlForTurn(sessionId, streamTurnId),
      signal: ac.signal,
      handlers: {
        onEvent: ({ eventType, payload }) => {
          if (
            (eventType === "text_delta" || eventType === "reasoning_delta") &&
            typeof payload.text === "string"
          ) {
            setText((prev) => `${prev}${payload.text}`);
            return;
          }
          if (eventType === "tool_call" || eventType === "tool_start") {
            const name =
              typeof payload.toolName === "string" ? payload.toolName : null;
            if (name) setToolName(name);
            return;
          }
          if (eventType === "llm_start") {
            setToolName(null);
          }
        }
      }
    }).catch(() => {
      void 0;
    });
    return () => {
      ac.abort();
    };
  }, [active, sessionId, streamTurnId]);

  if (!active) return null;
  const preview =
    text.length > PREVIEW_MAX ? `…${text.slice(-PREVIEW_MAX)}` : text;
  if (!preview && !toolName) return null;
  return (
    <div
      className="mt-1 rounded border border-border/60 bg-background/80 px-2 py-1 text-[11px] leading-snug text-muted-foreground"
      data-testid="task-live-stream"
    >
      {toolName ? (
        <div className="mb-0.5 font-medium text-foreground/80">
          Tool: {toolName}
        </div>
      ) : null}
      {preview ? (
        <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words font-sans">
          {preview}
        </pre>
      ) : null}
    </div>
  );
}
