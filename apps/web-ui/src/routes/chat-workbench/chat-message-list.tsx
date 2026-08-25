import { type RefObject } from "react";
import { AssistantMarkdown } from "../../components/assistant-markdown.js";
import { StagePipelineTranscript } from "../../components/stage-pipeline-transcript.js";
import { ToolCalls } from "../../components/tool-calls.js";
import type { UiChatMessage } from "../../lib/chat-agent.js";
import {
  toolPartsOf as toolPartsFromUnknown,
  type ToolPart
} from "../../lib/tool-display.js";
import { cn } from "../../lib/utils.js";

const N_80 = 80;

function extractMessageText(message: UiChatMessage): string {
  return message.parts
    .filter(
      (
        p
      ): p is {
        type: string;
        text: string;
      } => p.type === "text" && typeof p.text === "string"
    )
    .map((p) => p.text)
    .join("");
}

function toolPartsOf(message: UiChatMessage): ToolPart[] {
  return toolPartsFromUnknown(message.parts);
}

function ChatMessageBubble(options: {
  message: UiChatMessage;
  stickyUser: boolean;
}) {
  const { message: m, stickyUser } = options;
  const text = extractMessageText(m);
  return (
    <div
      className={cn(
        "max-w-[90%]",
        m.role === "user" ? "ml-auto" : "",
        stickyUser &&
          "sticky top-0 z-20 ml-0 max-w-none border-b border-border/60 bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      )}
    >
      <div
        className={cn(
          "rounded-lg px-3 py-2",
          m.role === "user"
            ? stickyUser
              ? "bg-muted text-foreground text-sm"
              : "bg-primary text-primary-foreground text-sm"
            : "bg-muted"
        )}
      >
        {m.role === "assistant" ? (
          <AssistantMarkdown text={text} streamingIndicator={false} />
        ) : (
          <span className="whitespace-pre-wrap">{text}</span>
        )}
        <ToolCalls parts={toolPartsOf(m)} showEmoji />
      </div>
    </div>
  );
}

function StreamingBubble(options: {
  streamingText: string;
  liveToolParts: ToolPart[];
}) {
  const { streamingText, liveToolParts } = options;
  return (
    <div className="max-w-[90%]">
      <div className="rounded-lg px-3 py-2 bg-muted">
        <AssistantMarkdown text={streamingText || "…"} streamingIndicator />
        <ToolCalls parts={liveToolParts} showEmoji />
      </div>
    </div>
  );
}

export function ChatMessageList(options: {
  scrollerRef: RefObject<HTMLDivElement | null>;
  stickToBottomRef: RefObject<boolean>;
  sessionKind: "ticket" | "workbench";
  projectId: string;
  chatId: string;
  messages: UiChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  liveToolParts: ToolPart[];
  status: "ready" | "submitted" | "streaming" | "error";
  error: Error | null;
  clearError: () => void;
  lastUserIndex: number;
}) {
  const {
    scrollerRef,
    stickToBottomRef,
    sessionKind,
    projectId,
    chatId,
    messages,
    isStreaming,
    streamingText,
    liveToolParts,
    status,
    error,
    clearError,
    lastUserIndex
  } = options;
  return (
    <div
      ref={scrollerRef}
      className="flex-1 overflow-y-auto"
      onScroll={(e) => {
        const el = e.currentTarget;
        const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
        stickToBottomRef.current = distance < N_80;
      }}
    >
      {sessionKind === "ticket" && (
        <StagePipelineTranscript projectId={projectId} chatId={chatId} />
      )}
      <div className="space-y-3 px-3 py-3">
        {messages.length === 0 && !isStreaming && (
          <p className="text-sm text-muted-foreground text-center mt-4">
            {sessionKind === "workbench"
              ? "Manual workbench — send a message to work interactively in this session’s sandbox."
              : "Builder chat — send a message to work interactively in this ticket’s sandbox."}
          </p>
        )}
        {messages.map((m, index) => (
          <ChatMessageBubble
            key={m.id}
            message={m}
            stickyUser={m.role === "user" && index === lastUserIndex}
          />
        ))}
        {isStreaming && (streamingText || liveToolParts.length > 0) && (
          <StreamingBubble
            streamingText={streamingText}
            liveToolParts={liveToolParts}
          />
        )}
        {status === "submitted" && !streamingText && (
          <div className="text-xs text-muted-foreground italic">Thinking…</div>
        )}
        {error && (
          <div className="text-xs text-destructive flex items-center gap-2">
            <span>{error.message}</span>
            <button onClick={() => clearError()} className="underline">
              dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
