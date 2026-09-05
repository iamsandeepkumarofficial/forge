import { LoaderCircle, X } from "lucide-react";
import type { TerminalTab } from "../../lib/session-terminal.js";

export function TabButton(options: {
  tab: TerminalTab;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  const { tab, active, onSelect, onClose } = options;
  const showRunning = (tab.kind === "app" || tab.kind === "job") && tab.running;
  return (
    <span
      className={`group flex w-full items-center gap-1 rounded px-1.5 py-1 text-[0.65rem] ${
        active
          ? "bg-gray-800 text-gray-100"
          : "text-gray-400 hover:bg-gray-900 hover:text-gray-200"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
      >
        {showRunning ? (
          <LoaderCircle
            className="size-3 shrink-0 animate-spin text-gray-300 [animation-duration:2.8s]"
            aria-label="Running"
          />
        ) : null}
        <span className="truncate">{tab.label}</span>
      </button>
      {tab.closable ? (
        <button
          type="button"
          aria-label={`Close ${tab.label}`}
          title="Close tab"
          onClick={onClose}
          className="shrink-0 text-gray-500 opacity-60 hover:text-gray-200 group-hover:opacity-100"
        >
          <X className="size-2.5" />
        </button>
      ) : null}
    </span>
  );
}
