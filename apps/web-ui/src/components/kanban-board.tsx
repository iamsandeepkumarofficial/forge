import { useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { Plus, Columns3 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  COLUMNS,
  CardAwarePointerSensor,
  type ChatItem,
  type ChatPatch,
  type ChatStatus,
  type KanbanBoardProps
} from "./kanban-shared.js";
import { CardContent } from "./kanban-card-content.js";
import { CardMenu } from "./kanban-card-menu.js";

export type {
  ChatStatus,
  ChatType,
  ChatPriority,
  ChatItem,
  ChatPatch
} from "./kanban-shared.js";
export { COLUMNS } from "./kanban-shared.js";
export { CardContent } from "./kanban-card-content.js";

const DRAG_ACTIVATION_DISTANCE = 5;

function DroppableColumn(options: {
  status: ChatStatus;
  label: string;
  count: number;
  children: ReactNode;
}) {
  const { status, label, count, children } = options;
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`w-72 flex-shrink-0 flex flex-col rounded-lg border border-transparent ${isOver ? "border-primary" : ""}`}
    >
      <div className="p-3 font-semibold">
        {label} ({count})
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px]">
        {children}
      </div>
    </div>
  );
}

function DraggableCard(options: {
  chat: ChatItem;
  parentTitle?: string;
  selected?: boolean;
  onOpen: () => void;
  onPatch: (updates: ChatPatch) => Promise<void>;
  onDelete: () => Promise<void>;
  onAddSubtask: (title: string) => Promise<void>;
}) {
  const {
    chat,
    parentTitle,
    selected,
    onOpen,
    onPatch,
    onDelete,
    onAddSubtask
  } = options;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: chat.id
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "relative rounded-xl border border-border hover:shadow-md bg-background",
        isDragging && "opacity-30",
        selected && "ring-2 ring-primary ring-offset-1"
      )}
    >
      <CardMenu
        chat={chat}
        onPatch={onPatch}
        onDelete={onDelete}
        onAddSubtask={onAddSubtask}
      />
      <div
        onClick={() => {
          if (!isDragging) onOpen();
        }}
        className="p-3 cursor-pointer"
      >
        <CardContent chat={chat} parentTitle={parentTitle} />
      </div>
    </div>
  );
}

function AddCardButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      data-no-dnd
      onClick={onClick}
      className="w-full flex items-center justify-center gap-1 rounded-lg border border-dashed border-border px-2 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Plus size={14} /> Add
    </button>
  );
}

function AddSectionPanel({ onClick }: { onClick: () => void }) {
  return (
    <div className="w-72 flex-shrink-0 flex flex-col justify-start pt-[52px]">
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center justify-center gap-1 rounded-lg border border-dashed border-border px-2 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Columns3 size={14} />
        Add section
      </button>
    </div>
  );
}

function KanbanColumns(options: {
  chats: ChatItem[];
  chatById: Map<string, ChatItem>;
  selectedChatId?: string | null;
  onOpen: (chatId: string) => void;
  onPatch: (chatId: string, updates: ChatPatch) => Promise<void>;
  onDelete: (chatId: string) => Promise<void>;
  onAddSubtask: (parentId: string, title: string) => Promise<void>;
  onAddInColumn?: (status: ChatStatus) => void;
  onAddSection?: () => void;
}) {
  const {
    chats,
    chatById,
    selectedChatId,
    onOpen,
    onPatch,
    onDelete,
    onAddSubtask,
    onAddInColumn,
    onAddSection
  } = options;
  return (
    <div className="flex gap-4 h-full overflow-x-auto">
      {COLUMNS.map(({ status, label }, index) => {
        const columnChats = chats.filter((c) => c.status === status);
        return (
          <div key={status} className="flex gap-4">
            <DroppableColumn
              status={status}
              label={label}
              count={columnChats.length}
            >
              {columnChats.map((chat) => (
                <DraggableCard
                  key={chat.id}
                  chat={chat}
                  selected={selectedChatId === chat.id}
                  parentTitle={
                    chat.parentId
                      ? chatById.get(chat.parentId)?.title
                      : undefined
                  }
                  onOpen={() => onOpen(chat.id)}
                  onPatch={(updates) => onPatch(chat.id, updates)}
                  onDelete={() => onDelete(chat.id)}
                  onAddSubtask={(title) => onAddSubtask(chat.id, title)}
                />
              ))}
              {onAddInColumn && (
                <AddCardButton onClick={() => onAddInColumn(status)} />
              )}
            </DroppableColumn>
            {index === COLUMNS.length - 1 && (
              <AddSectionPanel
                onClick={() =>
                  onAddSection ? onAddSection() : onAddInColumn?.("no_section")
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function KanbanBoard({
  chats,
  onUpdate,
  onOpen,
  onPatch,
  onDelete,
  onAddSubtask,
  onAddInColumn,
  onAddSection,
  selectedChatId
}: KanbanBoardProps) {
  const sensors = useSensors(
    useSensor(CardAwarePointerSensor, {
      activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE }
    })
  );
  const chatById = new Map(chats.map((c) => [c.id, c]));
  const [activeChat, setActiveChat] = useState<ChatItem | null>(null);
  const handleDragStart = (event: DragStartEvent) => {
    const chat = chatById.get(event.active.id as string);
    setActiveChat(chat ?? null);
  };
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveChat(null);
    const { active, over } = event;
    if (!over) return;
    const chat = chatById.get(active.id as string);
    if (!chat) return;
    const targetStatus = over.id as ChatStatus;
    if (!COLUMNS.some((c) => c.status === targetStatus)) return;
    if (chat.status === targetStatus) return;
    try {
      await onUpdate(chat.id, targetStatus);
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };
  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveChat(null)}
    >
      <KanbanColumns
        chats={chats}
        chatById={chatById}
        selectedChatId={selectedChatId}
        onOpen={onOpen}
        onPatch={onPatch}
        onDelete={onDelete}
        onAddSubtask={onAddSubtask}
        onAddInColumn={onAddInColumn}
        onAddSection={onAddSection}
      />
      <DragOverlay>
        {activeChat ? (
          <div className="p-3 rounded-xl border border-border shadow-lg bg-background cursor-grabbing">
            <CardContent
              chat={activeChat}
              parentTitle={
                activeChat.parentId
                  ? chatById.get(activeChat.parentId)?.title
                  : undefined
              }
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
