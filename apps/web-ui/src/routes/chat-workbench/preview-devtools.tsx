import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { MousePointer2, SquareTerminal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  capEntries,
  formatDomLabel,
  formatNetworkStatus,
  parseConsoleMessage,
  parseDomResult,
  parseInspectPick,
  parseNetworkMessage,
  postToPreviewInspect,
  type ConsoleEntry,
  type DevtoolsTab,
  type DomNode,
  type NetworkEntry,
  type PreviewPickSummary
} from "./preview-devtools-model.js";

export function PreviewDevtools() {
  const [tab, setTab] = useState<DevtoolsTab>("console");
  const [logs, setLogs] = useState<ConsoleEntry[]>([]);
  const [requests, setRequests] = useState<NetworkEntry[]>([]);
  const [tree, setTree] = useState<DomNode | null>(null);
  const [treeError, setTreeError] = useState("");
  const [pick, setPick] = useState<PreviewPickSummary | null>(null);
  const [selecting, setSelecting] = useState(false);
  const seq = useRef(0);
  const logEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const consoleEntry = parseConsoleMessage(e.data);
      if (consoleEntry) {
        seq.current += 1;
        setLogs((prev) =>
          capEntries([...prev, { ...consoleEntry, id: `c${seq.current}` }])
        );
        return;
      }
      const networkEntry = parseNetworkMessage(e.data);
      if (networkEntry) {
        seq.current += 1;
        setRequests((prev) =>
          capEntries([...prev, { ...networkEntry, id: `n${seq.current}` }])
        );
        return;
      }
      const dom = parseDomResult(e.data);
      if (dom) {
        if ("error" in dom) {
          setTree(null);
          setTreeError(dom.error);
          return;
        }
        setTreeError("");
        setTree(dom);
        return;
      }
      if (!selecting) return;
      const nextPick = parseInspectPick(e.data);
      if (nextPick) {
        setPick(nextPick);
        setSelecting(false);
        postToPreviewInspect({ type: "forge-inspect-set", on: false });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [selecting]);

  useEffect(() => {
    if (tab !== "elements") return;
    postToPreviewInspect({ type: "forge-devtools-dom" });
  }, [tab]);

  useEffect(() => {
    logEnd.current?.scrollIntoView?.({ block: "end" });
  }, [logs.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !selecting) return;
      setSelecting(false);
      postToPreviewInspect({ type: "forge-inspect-set", on: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting]);

  const evalId = useId();
  const onEval = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const field = e.currentTarget.elements.namedItem("expr");
    if (!(field instanceof HTMLInputElement)) return;
    const expr = field.value.trim();
    if (!expr) return;
    postToPreviewInspect({ type: "forge-devtools-eval", expr });
    field.value = "";
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-background"
      data-testid="preview-devtools"
    >
      <div className="flex shrink-0 items-center gap-1 border-b px-2 py-1">
        <SquareTerminal className="size-3.5 text-muted-foreground" />
        {(
          [
            ["console", "Console"],
            ["elements", "Elements"],
            ["network", "Network"]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
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
          onClick={() => {
            if (tab === "network") setRequests([]);
            else setLogs([]);
          }}
          aria-label={tab === "network" ? "Clear network" : "Clear console"}
        >
          <Trash2 className="size-3" />
          Clear
        </button>
      </div>
      {tab === "console" ? (
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
                    entry.level === "warn" &&
                      "text-amber-700 dark:text-amber-300"
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
      ) : null}
      {tab === "elements" ? (
        <div className="min-h-0 flex-1 overflow-auto px-2 py-2 text-[11px]">
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              aria-pressed={selecting}
              onClick={() => {
                const next = !selecting;
                setSelecting(next);
                postToPreviewInspect({ type: "forge-inspect-set", on: next });
              }}
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
      ) : null}
      {tab === "network" ? (
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
                        entry.status >= 400 || entry.error
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
      ) : null}
    </div>
  );
}

function DomTree({ node, depth }: { node: DomNode; depth: number }) {
  return (
    <div>
      <div
        className="font-mono text-foreground"
        style={{ paddingLeft: depth * 12 }}
      >
        {formatDomLabel(node)}
      </div>
      {node.children.map((child, index) => (
        <DomTree key={`${child.tag}-${index}`} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}
