import type { FormEvent, RefObject } from "react";
import { MousePointer2, SquareTerminal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatDomLabel,
  formatNetworkStatus,
  type ConsoleEntry,
  type DevtoolsTab,
  type DomNode,
  type NetworkEntry,
  type PreviewPickSummary
} from "./preview-devtools-model.js";

const HTTP_ERROR_STATUS = 400;
const DOM_INDENT_PX = 12;

const TAB_BUTTONS: ReadonlyArray<readonly [DevtoolsTab, string]> = [
  ["console", "Console"],
  ["elements", "Elements"],
  ["network", "Network"]
];

export function DevtoolsTabBar(options: {
  tab: DevtoolsTab;
  onTab: (tab: DevtoolsTab) => void;
  onClear: () => void;
}) {
  const { tab, onTab, onClear } = options;
  return (
    <div className="flex shrink-0 items-center gap-1 border-b px-2 py-1">
      <SquareTerminal className="size-3.5 text-muted-foreground" />
      {TAB_BUTTONS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={tab === id}
          onClick={() => onTab(id)}
          className={cn(
            "rounded-md px-2 py-0.5 text-[11px] font-medium",
            tab === id
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={onClear}
        aria-label={tab === "network" ? "Clear network" : "Clear console"}
      >
        <Trash2 className="size-3" />
        Clear
      </button>
    </div>
  );
}

export function ConsolePanel(options: {
  logs: ConsoleEntry[];
  logEnd: RefObject<HTMLDivElement | null>;
  evalId: string;
  onEval: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const { logs, logEnd, evalId, onEval } = options;
  return (
    <>
      <div className="min-h-0 flex-1 overflow-auto font-mono text-[11px]">
        {logs.length === 0 ? (
          <p className="px-3 py-2 text-muted-foreground">
            Console output from the preview will appear here.
          </p>
        ) : (
          logs.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                "border-b border-border/60 px-3 py-0.5 whitespace-pre-wrap",
                entry.level === "error" && "text-red-600 dark:text-red-400",
                entry.level === "warn" && "text-amber-700 dark:text-amber-300"
              )}
            >
              {entry.args.join(" ")}
            </div>
          ))
        )}
        <div ref={logEnd} />
      </div>
      <form
        className="flex shrink-0 items-center gap-1.5 border-t px-2 py-1"
        onSubmit={onEval}
      >
        <label htmlFor={evalId} className="sr-only">
          Console expression
        </label>
        <span className="text-xs text-muted-foreground">›</span>
        <input
          id={evalId}
          name="expr"
          autoComplete="off"
          placeholder="Evaluate in the preview"
          className="min-w-0 flex-1 bg-transparent font-mono text-[11px] outline-none"
        />
      </form>
    </>
  );
}

export function ElementsPanel(options: {
  selecting: boolean;
  pick: PreviewPickSummary | null;
  tree: DomNode | null;
  treeError: string;
  onToggleSelect: () => void;
}) {
  const { selecting, pick, tree, treeError, onToggleSelect } = options;
  return (
    <div className="min-h-0 flex-1 overflow-auto px-2 py-2 text-[11px]">
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          aria-pressed={selecting}
          onClick={onToggleSelect}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5",
            selecting
              ? "border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MousePointer2 className="size-3" />
          Select element
        </button>
        {pick ? (
          <span className="font-mono text-muted-foreground">
            {pick.tag}
            {pick.selector ? ` ${pick.selector}` : ""}
            {pick.text ? ` “${pick.text}”` : ""}
          </span>
        ) : null}
      </div>
      {treeError ? (
        <p className="text-muted-foreground">{treeError}</p>
      ) : tree ? (
        <DomTree node={tree} depth={0} />
      ) : (
        <p className="text-muted-foreground">
          Reload the preview to inspect the document.
        </p>
      )}
    </div>
  );
}

export function NetworkPanel(options: { requests: NetworkEntry[] }) {
  const { requests } = options;
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      {requests.length === 0 ? (
        <p className="px-3 py-2 text-[11px] text-muted-foreground">
          Fetch and XHR from the preview will appear here.
        </p>
      ) : (
        <table className="w-full text-left font-mono text-[11px]">
          <thead className="sticky top-0 bg-background text-muted-foreground">
            <tr>
              <th className="px-2 py-1 font-medium">Method</th>
              <th className="px-2 py-1 font-medium">Status</th>
              <th className="px-2 py-1 font-medium">URL</th>
              <th className="px-2 py-1 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((entry) => (
              <tr key={entry.id} className="border-t border-border/60">
                <td className="px-2 py-0.5">{entry.method}</td>
                <td
                  className={cn(
                    "px-2 py-0.5",
                    entry.status >= HTTP_ERROR_STATUS || entry.error
                      ? "text-red-600 dark:text-red-400"
                      : undefined
                  )}
                >
                  {formatNetworkStatus(entry)}
                </td>
                <td className="max-w-0 truncate px-2 py-0.5" title={entry.url}>
                  {entry.url}
                </td>
                <td className="px-2 py-0.5 text-muted-foreground">
                  {entry.duration}ms
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DomTree(options: { node: DomNode; depth: number }) {
  const { node, depth } = options;
  return (
    <div>
      <div
        className="font-mono text-foreground"
        style={{ paddingLeft: depth * DOM_INDENT_PX }}
      >
        {formatDomLabel(node)}
      </div>
      {node.children.map((child, index) => (
        <DomTree key={`${child.tag}-${index}`} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}
