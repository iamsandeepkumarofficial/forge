import type { ChatFeatureType } from "../lib/projects-api.js";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_WORKFLOW_ID,
  type ChatPriority
} from "./new-chat-dialog-shared.js";
import type { NewChatDialogState } from "./use-new-chat-dialog.js";

export function NewChatTypePriorityFields({
  state
}: {
  state: NewChatDialogState;
}) {
  const { type, setType, priority, setPriority } = state;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="ticket-type">Type</Label>
        <select
          id="ticket-type"
          value={type}
          onChange={(e) => setType(e.target.value as ChatFeatureType)}
          className="w-full border border-border rounded-md bg-background px-2 py-2 text-sm"
        >
          <option value="feature">Feature</option>
          <option value="bug">Bug</option>
          <option value="refactor">Refactor</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ticket-priority">Priority</Label>
        <select
          id="ticket-priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as ChatPriority)}
          className="w-full border border-border rounded-md bg-background px-2 py-2 text-sm"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>
    </div>
  );
}

export function NewChatMetaFields({ state }: { state: NewChatDialogState }) {
  const {
    workflowId,
    setWorkflowId,
    workflows,
    dueDate,
    setDueDate,
    parentId,
    setParentId,
    parentOptions
  } = state;
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="ticket-workflow">Workflow</Label>
        <select
          id="ticket-workflow"
          value={workflowId}
          onChange={(e) => setWorkflowId(e.target.value)}
          required
          className="w-full border border-border rounded-md bg-background px-2 py-2 text-sm"
        >
          {workflows.length === 0 ? (
            <option value={DEFAULT_WORKFLOW_ID}>sdlc (default)</option>
          ) : (
            workflows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.id}){w.source === "user" ? " · user" : ""}
              </option>
            ))
          )}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ticket-due">Due date</Label>
          <Input
            id="ticket-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ticket-parent">Parent ticket</Label>
          <select
            id="ticket-parent"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="w-full border border-border rounded-md bg-background px-2 py-2 text-sm"
          >
            <option value="">None — top-level</option>
            {parentOptions.map((chat) => (
              <option key={chat.id} value={chat.id}>
                {chat.title}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
