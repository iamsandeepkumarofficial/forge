import { Plus } from "lucide-react";
import type { TerminalTab } from "../../lib/session-terminal.js";
import { TabButton } from "./terminal-tab-button.js";

export function TerminalTabList(options: {
  width: number;
  shells: TerminalTab[];
  apps: TerminalTab[];
  jobs: TerminalTab[];
  activeTabId: string | null;
  busy: boolean;
  error: string | null;
  onSelect: (tabId: string) => void;
  onClose: (tab: TerminalTab) => void;
  onCreate: () => void;
  onResizePointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const o = options;
  return (
    <>
      <div
        data-testid="terminal-tab-list"
        style={{ width: o.width }}
        className="flex shrink-0 flex-col gap-0.5 overflow-y-auto bg-gray-950 px-1 py-1"
      >
        {[...o.shells, ...o.apps, ...o.jobs].map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            active={tab.id === o.activeTabId}
            onSelect={() => o.onSelect(tab.id)}
            onClose={() => o.onClose(tab)}
          />
        ))}
        <button
          type="button"
          aria-label="New shell tab"
          title="New shell tab"
          disabled={o.busy}
          onClick={o.onCreate}
          className="inline-flex h-6 items-center justify-center gap-1 rounded border border-dashed border-gray-700 px-1.5 text-[0.65rem] text-gray-400 hover:border-gray-500 hover:bg-gray-900 hover:text-gray-200 disabled:opacity-40"
        >
          <Plus className="size-3" />
          Shell
        </button>
        {o.busy ? (
          <span className="px-1 text-[0.65rem] text-gray-500">Creating…</span>
        ) : null}
        {o.error ? (
          <span className="truncate px-1 text-[0.65rem] text-red-400">
            {o.error}
          </span>
        ) : null}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize terminal tab list"
        title="Drag to resize tab list"
        onPointerDown={o.onResizePointerDown}
        className="w-1 shrink-0 cursor-col-resize touch-none bg-gray-900 hover:bg-gray-600"
      />
    </>
  );
}
