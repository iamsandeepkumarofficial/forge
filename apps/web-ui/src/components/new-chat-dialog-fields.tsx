import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  NewChatAttachmentsSection,
  NewChatLinksSection
} from "./new-chat-dialog-extras.js";
import {
  NewChatMetaFields,
  NewChatTypePriorityFields
} from "./new-chat-dialog-meta.js";
import type { NewChatDialogState } from "./use-new-chat-dialog.js";

export function NewChatDialogFields({ state }: { state: NewChatDialogState }) {
  const {
    title,
    setTitle,
    description,
    setDescription,
    executionTarget,
    setExecutionTarget
  } = state;
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="ticket-title">Title</Label>
        <Input
          id="ticket-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Add login flow"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ticket-execution-target">Agent runtime</Label>
        <select
          id="ticket-execution-target"
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          value={executionTarget}
          onChange={(e) =>
            setExecutionTarget(e.target.value === "cloud" ? "cloud" : "local")
          }
        >
          <option value="local">Normal (local host)</option>
          <option value="cloud">Cloud (Docker)</option>
        </select>
      </div>
      <NewChatTypePriorityFields state={state} />
      <NewChatMetaFields state={state} />
      <div className="space-y-1.5">
        <Label htmlFor="ticket-description">Description</Label>
        <Textarea
          id="ticket-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Context, acceptance criteria, notes…"
          rows={4}
          className="resize-y min-h-[88px]"
        />
      </div>
      <NewChatAttachmentsSection state={state} />
      <NewChatLinksSection state={state} />
    </>
  );
}
