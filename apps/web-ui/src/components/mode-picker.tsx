import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "./ui/dropdown-menu.js";
import { cn } from "../lib/utils.js";
import { AGENT_MODES, type ComposerAgentMode } from "./chat-composer-shared.js";

export function ModePicker(options: {
  value: ComposerAgentMode;
  onChange: (mode: ComposerAgentMode) => void;
}) {
  const { value, onChange } = options;
  const current = AGENT_MODES.find((m) => m.id === value) ?? AGENT_MODES[0]!;
  const Icon = current.icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 text-xs font-medium text-foreground hover:bg-muted outline-none">
        <Icon className="size-3.5 opacity-70" />
        {current.label}
        <ChevronDown className="size-3 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        className="min-w-44 p-1.5"
      >
        {AGENT_MODES.map((mode) => {
          const ModeIcon = mode.icon;
          const selected = mode.id === value;
          return (
            <DropdownMenuItem
              key={mode.id}
              disabled={!mode.enabled}
              onClick={() => onChange(mode.id)}
              className={cn(
                "gap-2 rounded-md px-2 py-1.5",
                selected && "bg-accent"
              )}
            >
              <ModeIcon className="size-4 opacity-70" />
              <span className="flex-1">{mode.label}</span>
              {selected ? <Check className="size-3.5 opacity-70" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
