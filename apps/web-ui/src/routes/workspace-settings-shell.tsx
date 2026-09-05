import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SettingsTab } from "./workspace-settings-helpers.js";

const TAB_LABELS: readonly [SettingsTab, string][] = [
  ["overview", "Overview"],
  ["parameters", "Parameter store"],
  ["databases", "Databases"],
  ["environment", "Environment"]
];

export function WorkspaceSettingsLoading() {
  return (
    <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      Loading…
    </div>
  );
}

export function WorkspaceSettingsError({ message }: { message: string }) {
  return (
    <div className="p-6">
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
}

export function WorkspaceSettingsTabNav(options: {
  tab: SettingsTab;
  onTab: (tab: SettingsTab) => void;
}) {
  const { tab, onTab } = options;
  return (
    <nav className="flex flex-wrap gap-1 rounded-lg bg-muted/40 p-1">
      {TAB_LABELS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onTab(id)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm",
            tab === id
              ? "bg-background font-medium shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
