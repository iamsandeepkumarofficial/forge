import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Copy, GitBranch, Loader2, MoreHorizontal, Undo2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { copyText } from "./preview-overflow.js";
import { acquirePreviewOverlayLock } from "./preview-overlay-lock.js";
import { cn } from "../../lib/utils.js";

const actionBtnClass =
  "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40";

function MessageActionButton(options: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={options.label}
      title={options.label}
      disabled={options.disabled}
      onClick={options.onClick}
      className={actionBtnClass}
    >
      {options.children}
    </button>
  );
}

export function MessageActionsRow(options: {
  align?: "start" | "end";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-0.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100 group-focus-within/msg:opacity-100 [@media(hover:none)]:opacity-100",
        options.align === "end" ? "justify-end" : "justify-start"
      )}
    >
      {options.children}
    </div>
  );
}

export function AssistantMessageActions(options: {
  text: string;
  onBranch?: () => void | Promise<void>;
}) {
  const { text, onBranch } = options;
  const [busy, setBusy] = useState(false);
  const hasText = Boolean(text.trim());
  const copy = () => {
    if (!hasText) return;
    void copyText(text);
  };
  return (
    <MessageActionsRow>
      {hasText ? (
        <MessageActionButton label="Copy" onClick={copy}>
          <Copy className="size-3.5" />
        </MessageActionButton>
      ) : null}
      {onBranch ? (
        <MessageActionButton
          label="Branch chat"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void Promise.resolve(onBranch()).finally(() => setBusy(false));
          }}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <GitBranch className="size-3.5" />
          )}
        </MessageActionButton>
      ) : null}
      {hasText ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More actions"
            title="More actions"
            className={actionBtnClass}
          >
            <MoreHorizontal className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem onClick={copy}>Copy as Markdown</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </MessageActionsRow>
  );
}

export function UserMessageUndoButton(options: { onUndo: () => void }) {
  return (
    <MessageActionsRow align="end">
      <MessageActionButton label="Undo" onClick={options.onUndo}>
        <Undo2 className="size-3.5" />
      </MessageActionButton>
    </MessageActionsRow>
  );
}

export function RevertChatDialog(options: {
  onCancel: () => void;
  onRevert: () => void;
}) {
  const { onCancel, onRevert } = options;
  useEffect(() => acquirePreviewOverlayLock(), []);
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel"
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-labelledby="revert-chat-title"
        aria-modal="true"
        className="relative w-full max-w-sm rounded-xl border bg-background p-4 shadow-xl"
      >
        <h2 id="revert-chat-title" className="text-sm font-semibold">
          Revert this chat?
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Later messages after this prompt will be removed, and files the
          assistant changed from that prompt onward will be rolled back. Then
          the assistant will answer the edited prompt.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onRevert}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            Revert back
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
