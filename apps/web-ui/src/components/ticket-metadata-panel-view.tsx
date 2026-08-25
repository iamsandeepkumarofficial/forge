import type { ChatFeatureType } from "@/lib/projects-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TicketMetadataAttachments } from "./ticket-metadata-attachments.js";
import { TicketMetadataLinks } from "./ticket-metadata-links.js";
import type { TicketMetadataState } from "./use-ticket-metadata-panel.js";

export function TicketMetadataFields({
  state
}: {
  state: TicketMetadataState;
}) {
  const {
    type,
    setType,
    dueDate,
    setDueDate,
    parentId,
    setParentId,
    parentOptions,
    saving,
    saveFields
  } = state;
  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <Label htmlFor="task-type">Task type</Label>
        <select
          id="task-type"
          className="border rounded px-2 py-1.5 bg-background"
          value={type}
          onChange={(e) => setType(e.target.value as ChatFeatureType)}
        >
          <option value="feature">Feature</option>
          <option value="bug">Bug</option>
          <option value="refactor">Refactor</option>
        </select>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="due-date">Due date</Label>
        <Input
          id="due-date"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="parent">Parent ticket</Label>
        <select
          id="parent"
          className="border rounded px-2 py-1.5 bg-background"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
        >
          <option value="">None</option>
          {parentOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      <Button
        type="button"
        size="sm"
        disabled={saving}
        onClick={() => void saveFields()}
      >
        {saving ? "Saving…" : "Save fields"}
      </Button>
    </div>
  );
}

export function TicketMetadataPanelView(options: {
  state: TicketMetadataState;
  hideHeading: boolean;
}) {
  const { state, hideHeading } = options;
  return (
    <div className="space-y-4 text-sm">
      {!hideHeading && <h3 className="font-semibold text-base">Details</h3>}
      {state.error && (
        <div className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-destructive text-xs">
          {state.error}
        </div>
      )}
      <TicketMetadataFields state={state} />
      <TicketMetadataAttachments state={state} />
      <TicketMetadataLinks state={state} />
    </div>
  );
}
