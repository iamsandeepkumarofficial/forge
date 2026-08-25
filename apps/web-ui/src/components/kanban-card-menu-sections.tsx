import {
  MoreHorizontal,
  Flag,
  Calendar,
  CalendarClock,
  CalendarRange
} from "lucide-react";
import {
  DropdownMenuGroup,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import {
  N_7,
  PRIORITY_LABEL,
  PRIORITY_FLAG_CLASS,
  PRIORITY_ORDER,
  isoDateOffset,
  type ChatItem,
  type ChatPatch
} from "./kanban-shared.js";

export function DateQuickPicks(options: {
  dueDay: string;
  showCustomDate: boolean;
  onToggleCustom: () => void;
  onPatch: (updates: ChatPatch) => Promise<void>;
}) {
  const { dueDay, showCustomDate, onToggleCustom, onPatch } = options;
  const dateQuickPicks = [
    { key: "today", label: "Today", icon: Calendar, date: isoDateOffset(0) },
    {
      key: "tomorrow",
      label: "Tomorrow",
      icon: CalendarClock,
      date: isoDateOffset(1)
    },
    {
      key: "next-week",
      label: "Next week",
      icon: CalendarRange,
      date: isoDateOffset(N_7)
    }
  ];
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Date</DropdownMenuLabel>
      <div className="flex items-center gap-1 px-1.5 py-1">
        {dateQuickPicks.map(({ key, label, icon: Icon, date }) => {
          const active = dueDay === date;
          return (
            <button
              key={key}
              type="button"
              title={label}
              onClick={() => onPatch({ dueDate: active ? null : date })}
              className={`p-2 rounded border ${
                active
                  ? "border-primary bg-accent"
                  : "border-transparent hover:bg-muted"
              }`}
            >
              <Icon size={16} />
            </button>
          );
        })}
        <button
          type="button"
          title="Custom date"
          onClick={onToggleCustom}
          className={`p-2 rounded border ${
            showCustomDate
              ? "border-primary bg-accent"
              : "border-transparent hover:bg-muted"
          }`}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
      {showCustomDate && (
        <div className="px-1.5 pb-1.5">
          <input
            type="date"
            className="w-full border rounded px-1.5 py-1 text-sm"
            value={dueDay}
            onChange={(e) =>
              onPatch({ dueDate: e.target.value ? e.target.value : null })
            }
          />
        </div>
      )}
    </DropdownMenuGroup>
  );
}

export function PriorityPicks(options: {
  priority: ChatItem["priority"];
  onPatch: (updates: ChatPatch) => Promise<void>;
}) {
  const { priority, onPatch } = options;
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Priority</DropdownMenuLabel>
      <div className="flex items-center gap-1 px-1.5 py-1">
        {PRIORITY_ORDER.map((p) => {
          const active = priority === p;
          return (
            <button
              key={p}
              type="button"
              title={`${PRIORITY_LABEL[p]} priority`}
              onClick={() => onPatch({ priority: p })}
              className={`p-2 rounded border ${
                active
                  ? "border-primary bg-accent"
                  : "border-transparent hover:bg-muted"
              }`}
            >
              <Flag size={16} className={PRIORITY_FLAG_CLASS[p]} />
            </button>
          );
        })}
      </div>
    </DropdownMenuGroup>
  );
}
