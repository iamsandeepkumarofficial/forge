import { useState } from "react";
import { AssistantMarkdown } from "../../components/assistant-markdown.js";
import { ThinkingBlock } from "../../components/thinking-block.js";
import { ToolCalls } from "../../components/tool-calls.js";
import type { ToolPart } from "../../lib/tool-display.js";
import { cn } from "../../lib/utils.js";
import { UserMessageUndoButton } from "./chat-message-actions.js";

export function looksLikePlan(text: string): boolean {
  const numbered = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)]\s/.test(line));
  return numbered.length >= 2;
}

function UserTurnEditor(options: {
  text: string;
  onCancelEdit: () => void;
  onSubmitEdit: (text: string) => void;
}) {
  const { text, onCancelEdit, onSubmitEdit } = options;
  const [draft, setDraft] = useState(text);
  return (
    <div className="ml-auto w-full max-w-[92%]">
      <textarea
        aria-label="Edit message"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancelEdit();
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (draft.trim()) onSubmitEdit(draft.trim());
          }
        }}
        className="min-h-20 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm whitespace-pre-wrap text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      />
      <div className="mt-1.5 flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancelEdit}
          className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!draft.trim()}
          onClick={() => onSubmitEdit(draft.trim())}
          className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-40"
        >
          Submit
        </button>
      </div>
    </div>
  );
}

export function UserTurn(options: {
  text: string;
  editing: boolean;
  showUndo: boolean;
  onUndo: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: (text: string) => void;
}) {
  const { text, editing, showUndo, onUndo, onCancelEdit, onSubmitEdit } =
    options;
  if (editing) {
    return (
      <UserTurnEditor
        text={text}
        onCancelEdit={onCancelEdit}
        onSubmitEdit={onSubmitEdit}
      />
    );
  }
  return (
    <div className="group/msg ml-auto max-w-[92%]">
      <p className="rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap text-foreground">
        {text}
      </p>
      {showUndo ? <UserMessageUndoButton onUndo={onUndo} /> : null}
    </div>
  );
}

export function AssistantTurn(options: {
  text: string;
  reasoning?: string;
  tools: ToolPart[];
  streaming?: boolean;
  onOpenFile?: (path: string) => void;
}) {
  const { text, reasoning, tools, streaming, onOpenFile } = options;
  const plan = !streaming && looksLikePlan(text) && tools.length === 0;
  const expandTrail = !text.trim();
  return (
    <div className="max-w-none space-y-2">
      {reasoning ? (
        <ThinkingBlock
          text={reasoning}
          defaultOpen={Boolean(streaming) || expandTrail}
          streaming={Boolean(streaming && !text && tools.length === 0)}
        />
      ) : null}
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
          <AssistantMarkdown text={text} />
        </div>
      ) : null}
      <ToolCalls
        parts={tools}
        onOpenPath={onOpenFile}
        defaultOpen={expandTrail}
      />
    </div>
  );
}
