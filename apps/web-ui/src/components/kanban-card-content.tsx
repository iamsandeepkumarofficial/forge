import {
  Check,
  Flag,
  Calendar,
  GitBranch,
  MessageSquare,
  Bot
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  TYPE_LABEL,
  PRIORITY_LABEL,
  PRIORITY_FLAG_CLASS,
  formatDueDate,
  type ChatItem
} from "./kanban-shared.js";

function CardFooter(options: { chat: ChatItem }) {
  const { chat } = options;
  return (
    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
      {chat.dueDate && (
        <span className="flex items-center gap-1" title="Due date">
          <Calendar size={13} />
          {formatDueDate(chat.dueDate)}
        </span>
      )}
      {chat.subtaskTotal > 0 && (
        <span className="flex items-center gap-1" title="Subtasks">
          <GitBranch size={13} />
          {chat.subtaskDone}/{chat.subtaskTotal}
        </span>
      )}
      {chat.commentCount > 0 && (
        <span className="flex items-center gap-1" title="Comments">
          <MessageSquare size={13} />
          {chat.commentCount}
        </span>
      )}
    </div>
  );
}

export function CardContent(options: { chat: ChatItem; parentTitle?: string }) {
  const { chat, parentTitle } = options;
  const hasFooter =
    chat.subtaskTotal > 0 ||
    chat.commentCount > 0 ||
    Boolean(chat.dueDate) ||
    Boolean(chat.activeAgent);
  const done = chat.status === "done";
  return (
    <div className="flex gap-2.5">
      <span
        className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${done ? "bg-green-500 border-green-500" : "border-border"}`}
      >
        {done && (
          <Check
            size={10}
            strokeWidth={3}
            className="text-primary-foreground"
          />
        )}
      </span>
      <div className="min-w-0 flex-1 pr-5">
        {parentTitle && (
          <div className="text-xs text-muted-foreground mb-0.5 truncate">
            ↳ {parentTitle}
          </div>
        )}
        <div className="text-sm text-foreground line-clamp-3">{chat.title}</div>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          <Badge variant="outline" className="capitalize">
            {TYPE_LABEL[chat.type] ?? chat.type}
          </Badge>
          <span
            className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"
            title={`${PRIORITY_LABEL[chat.priority]} priority`}
          >
            <Flag size={12} className={PRIORITY_FLAG_CLASS[chat.priority]} />
            {PRIORITY_LABEL[chat.priority]}
          </span>
        </div>
        {chat.activeAgent && (
          <div
            className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary"
            title={`Agent running: ${chat.activeAgent.agentId}`}
          >
            <Bot size={12} className="shrink-0" />
            <span className="truncate font-medium">
              {chat.activeAgent.agentId}
            </span>
            <span className="opacity-80 capitalize">
              · {chat.activeAgent.state}
            </span>
          </div>
        )}
        {hasFooter && <CardFooter chat={chat} />}
      </div>
    </div>
  );
}
