import { Button } from "@/components/ui/button";
import { NewChatDialogFields } from "./new-chat-dialog-fields.js";
import type { NewChatDialogState } from "./use-new-chat-dialog.js";

export function NewChatDialogView({ state }: { state: NewChatDialogState }) {
  const { onClose, handleSubmit, loading, error } = state;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-background w-full max-w-lg rounded-xl border border-border shadow-xl max-h-[min(90vh,720px)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-ticket-title"
      >
        <div className="border-b border-border px-5 py-3">
          <h2 id="new-ticket-title" className="text-lg font-semibold">
            New ticket
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Capture the essentials before it lands on the board.
          </p>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-5 space-y-4">
          <NewChatDialogFields state={state} />
          {error && (
            <p className="text-sm text-destructive whitespace-pre-wrap">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating…" : "Create ticket"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
