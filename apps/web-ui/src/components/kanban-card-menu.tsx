import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { N_10, type ChatItem, type ChatPatch } from "./kanban-shared.js";
import { DateQuickPicks, PriorityPicks } from "./kanban-card-menu-sections.js";

function InlineDraftInput(options: {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const { value, placeholder, onChange, onCommit, onCancel } = options;
  return (
    <div className="p-1.5">
      <input
        autoFocus
        className="w-full border rounded px-1.5 py-1 text-sm"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit();
          if (e.key === "Escape") onCancel();
        }}
        onBlur={onCommit}
      />
    </div>
  );
}

function CardMenuBody(options: {
  chat: ChatItem;
  renaming: boolean;
  addingSubtask: boolean;
  showCustomDate: boolean;
  titleDraft: string;
  subtaskDraft: string;
  dueDay: string;
  setRenaming: (v: boolean) => void;
  setAddingSubtask: (v: boolean) => void;
  setShowCustomDate: (updater: boolean | ((v: boolean) => boolean)) => void;
  setTitleDraft: (v: string) => void;
  setSubtaskDraft: (v: string) => void;
  commitRename: () => void;
  commitSubtask: () => void;
  onPatch: (updates: ChatPatch) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const o = options;
  return (
    <DropdownMenuContent align="end" className="w-64">
      {o.renaming ? (
        <InlineDraftInput
          value={o.titleDraft}
          onChange={o.setTitleDraft}
          onCommit={o.commitRename}
          onCancel={() => o.setRenaming(false)}
        />
      ) : (
        <DropdownMenuItem onClick={() => o.setRenaming(true)}>
          <Pencil /> Rename
        </DropdownMenuItem>
      )}
      {o.addingSubtask ? (
        <InlineDraftInput
          value={o.subtaskDraft}
          placeholder="Subtask title"
          onChange={o.setSubtaskDraft}
          onCommit={o.commitSubtask}
          onCancel={() => o.setAddingSubtask(false)}
        />
      ) : (
        <DropdownMenuItem onClick={() => o.setAddingSubtask(true)}>
          <Plus /> Add subtask
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <DateQuickPicks
        dueDay={o.dueDay}
        showCustomDate={o.showCustomDate}
        onToggleCustom={() => o.setShowCustomDate((v) => !v)}
        onPatch={o.onPatch}
      />
      <DropdownMenuSeparator />
      <PriorityPicks priority={o.chat.priority} onPatch={o.onPatch} />
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        onClick={() => {
          if (
            window.confirm(`Delete "${o.chat.title}"? This cannot be undone.`)
          ) {
            void o.onDelete();
          }
        }}
      >
        <Trash2 /> Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}

export function CardMenu(options: {
  chat: ChatItem;
  onPatch: (updates: ChatPatch) => Promise<void>;
  onDelete: () => Promise<void>;
  onAddSubtask: (title: string) => Promise<void>;
}) {
  const { chat, onPatch, onDelete, onAddSubtask } = options;
  const [renaming, setRenaming] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [titleDraft, setTitleDraft] = useState(chat.title);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const commitRename = () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== chat.title) void onPatch({ title: trimmed });
    setRenaming(false);
  };
  const commitSubtask = () => {
    const trimmed = subtaskDraft.trim();
    if (trimmed) void onAddSubtask(trimmed);
    setSubtaskDraft("");
    setAddingSubtask(false);
  };
  return (
    <div
      data-no-dnd
      className="absolute top-1.5 right-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <DropdownMenu
        onOpenChange={(open) => {
          if (!open) {
            setRenaming(false);
            setAddingSubtask(false);
            setShowCustomDate(false);
            setTitleDraft(chat.title);
            setSubtaskDraft("");
          }
        }}
      >
        <DropdownMenuTrigger
          className="p-1 rounded hover:bg-muted text-muted-foreground"
          aria-label="Card options"
        >
          <MoreHorizontal size={16} />
        </DropdownMenuTrigger>
        <CardMenuBody
          chat={chat}
          renaming={renaming}
          addingSubtask={addingSubtask}
          showCustomDate={showCustomDate}
          titleDraft={titleDraft}
          subtaskDraft={subtaskDraft}
          dueDay={chat.dueDate ? chat.dueDate.slice(0, N_10) : ""}
          setRenaming={setRenaming}
          setAddingSubtask={setAddingSubtask}
          setShowCustomDate={setShowCustomDate}
          setTitleDraft={setTitleDraft}
          setSubtaskDraft={setSubtaskDraft}
          commitRename={commitRename}
          commitSubtask={commitSubtask}
          onPatch={onPatch}
          onDelete={onDelete}
        />
      </DropdownMenu>
    </div>
  );
}
