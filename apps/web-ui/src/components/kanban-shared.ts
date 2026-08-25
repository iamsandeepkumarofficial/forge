import type { PointerEvent as ReactPointerEvent } from "react";
import { PointerSensor } from "@dnd-kit/core";

export const N_10 = 10;
export const N_7 = 7;

export class CardAwarePointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent }: ReactPointerEvent) => {
        const target = nativeEvent.target as HTMLElement | null;
        return !target?.closest("[data-no-dnd]");
      }
    }
  ];
}
export type ChatStatus =
  | "no_section"
  | "planning"
  | "development"
  | "qa"
  | "done";
export type ChatType = "feature" | "bug" | "refactor";
export type ChatPriority = "low" | "medium" | "high" | "urgent";
export interface ChatItem {
  id: string;
  title: string;
  status: ChatStatus;
  type: ChatType;
  priority: ChatPriority;
  dueDate?: string | null;
  parentId?: string | null;
  order: number;
  commentCount: number;
  subtaskTotal: number;
  subtaskDone: number;
  activeAgent?: {
    stageId: string;
    agentId: string;
    state: "executing" | "next" | "done";
  } | null;
}
export interface ChatPatch {
  title?: string;
  priority?: ChatPriority;
  dueDate?: string | null;
}
export interface KanbanBoardProps {
  chats: ChatItem[];
  onUpdate: (chatId: string, status: ChatStatus) => Promise<void>;
  onOpen: (chatId: string) => void;
  onPatch: (chatId: string, updates: ChatPatch) => Promise<void>;
  onDelete: (chatId: string) => Promise<void>;
  onAddSubtask: (parentId: string, title: string) => Promise<void>;
  onAddInColumn?: (status: ChatStatus) => void;
  onAddSection?: () => void;
  selectedChatId?: string | null;
}
export const COLUMNS: {
  status: ChatStatus;
  label: string;
}[] = [
  { status: "no_section", label: "No Section" },
  { status: "planning", label: "Planning" },
  { status: "development", label: "Development" },
  { status: "qa", label: "QA" },
  { status: "done", label: "Done" }
];
export const PRIORITY_LABEL: Record<ChatPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent"
};
export const PRIORITY_FLAG_CLASS: Record<ChatPriority, string> = {
  urgent: "text-destructive fill-red-600",
  high: "text-orange-500 fill-orange-500",
  medium: "text-primary fill-blue-500",
  low: "text-muted-foreground"
};
export const PRIORITY_ORDER: ChatPriority[] = [
  "urgent",
  "high",
  "medium",
  "low"
];
export const TYPE_LABEL: Record<ChatType, string> = {
  feature: "Feature",
  bug: "Bug",
  refactor: "Refactor"
};
export function isoDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, N_10);
}
export function formatDueDate(iso: string): string {
  const day = iso.slice(0, N_10);
  try {
    return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    });
  } catch {
    return day;
  }
}
