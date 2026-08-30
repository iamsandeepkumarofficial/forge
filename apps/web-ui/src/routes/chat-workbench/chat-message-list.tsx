import { type RefObject } from "react";
import { AssistantMarkdown } from "../../components/assistant-markdown.js";
import { ToolCalls } from "../../components/tool-calls.js";
import type { UiChatMessage } from "../../lib/chat-agent.js";
import {
  toolPartsOf as toolPartsFromUnknown,
  type ToolPart
} from "../../lib/tool-display.js";
import { cn } from "../../lib/utils.js";
import { chatTurnActivity, liveToolName } from "./chat-turn-activity.js";

const N_80 = 80;

export const CHAT_STARTERS: { label: string; prompt: string }[] = [
  {
    label: "Explain this workspace",
    prompt:
      "Explain this workspace: what it is, how it is structured, and how to run it."
  },
  {
    label: "Fix setup blockers",
    prompt:
      "Analyze this workspace and fix setup blockers so the app can run and preview."
  },
  {
    label: "Add a feature",
    prompt:
      "Help me add a new feature. First ask what I want, then implement it."
  }
];

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

export function looksLikePlan(text: string): boolean {
  const numbered = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)]\s/.test(line));
  return numbered.length >= 2;
}

function UserTurn(options: { text: string }) {
  return (
    <div className="ml-auto max-w-[92%]">
      <p className="rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap text-foreground">
        {options.text}
      </p>
    </div>
  );
}

function AssistantTurn(options: {
  text: string;
  tools: ToolPart[];
  streaming?: boolean;
  onOpenFile?: (path: string) => void;
}) {
  const { text, tools, streaming, onOpenFile } = options;
  const plan = !streaming && looksLikePlan(text) && tools.length === 0;
  return (
    <div className="max-w-none space-y-2">
      {text ? (
        <div
          className={cn(
            plan && "rounded-lg border border-border bg-muted/30 px-3 py-2"
          )}
        >
          {plan ? (
            <p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Plan
            </p>
          ) : null}
          <AssistantMarkdown text={text} streamingIndicator={Boolean(streaming)} />
        </div>
      ) : streaming ? (
        <AssistantMarkdown text="…" streamingIndicator />
      ) : null}
      <ToolCalls parts={tools} onOpenPath={onOpenFile} />
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
  waiting?: boolean;
  error: Error | null;
  clearError: () => void;
  onPickStarter?: (prompt: string) => void;
  onOpenFile?: (path: string) => void;
}) {
  const {
    scrollerRef,
    stickToBottomRef,
    messages,
    isStreaming,
    streamingText,
    liveToolParts,
    status,
    waiting,
    error,
    clearError,
    onPickStarter,
    onOpenFile
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
      <div className="space-y-4 px-4 py-4">
        <TranscriptBody
          messages={messages}
          isStreaming={isStreaming}
          streamingText={streamingText}
          liveToolParts={liveToolParts}
          status={status}
          waiting={waiting}
          error={error}
          clearError={clearError}
          onPickStarter={onPickStarter}
          onOpenFile={onOpenFile}
        />
      </div>
    </div>
  );
}

function TranscriptBody(options: {
  messages: UiChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  liveToolParts: ToolPart[];
  status: "ready" | "submitted" | "streaming" | "error";
  waiting?: boolean;
  error: Error | null;
  clearError: () => void;
  onPickStarter?: (prompt: string) => void;
  onOpenFile?: (path: string) => void;
}) {
  const {
    messages,
    isStreaming,
    streamingText,
    liveToolParts,
    status,
    waiting,
    error,
    clearError,
    onPickStarter,
    onOpenFile
  } = options;
  return (
    <>
      {messages.length === 0 && !isStreaming ? (
        <EmptyChat onPickStarter={onPickStarter} />
      ) : null}
      {messages.map((m) =>
        m.role === "user" ? (
          <UserTurn key={m.id} text={extractMessageText(m)} />
        ) : (
          <AssistantTurn
            key={m.id}
            text={extractMessageText(m)}
            tools={toolPartsOf(m)}
            onOpenFile={onOpenFile}
          />
        )
      )}
      {isStreaming && (streamingText || liveToolParts.length > 0) ? (
        <AssistantTurn
          text={streamingText}
          tools={liveToolParts}
          streaming
          onOpenFile={onOpenFile}
        />
      ) : null}
      <TurnActivity
        label={chatTurnActivity({
          status,
          waiting,
          toolName: liveToolName(liveToolParts)
        })}
      />
      {error ? (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <span>{error.message}</span>
          <button onClick={() => clearError()} className="underline">
            dismiss
          </button>
        </div>
      ) : null}
    </>
  );
}

function TurnActivity({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 text-xs text-muted-foreground"
    >
      <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-primary" />
      <span>{label}</span>
    </div>
  );
}

function EmptyChat(options: { onPickStarter?: (prompt: string) => void }) {
  const { onPickStarter } = options;
  return (
    <div className="flex flex-col items-center gap-4 px-2 pt-8 text-center">
      <div>
        <p className="text-sm font-medium">What should we work on?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The agent edits this session’s sandbox. Preview appears when an app is
          running.
        </p>
      </div>
      {onPickStarter ? (
        <div className="flex w-full max-w-sm flex-col gap-2">
          {CHAT_STARTERS.map((starter) => (
            <button
              key={starter.label}
              type="button"
              onClick={() => onPickStarter(starter.prompt)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-left text-sm hover:bg-muted"
            >
              {starter.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
