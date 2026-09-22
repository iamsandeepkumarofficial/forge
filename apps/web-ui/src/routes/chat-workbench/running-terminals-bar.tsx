import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Square, Terminal } from "lucide-react";
import { stopApp } from "../../lib/tool-runner.js";
import { stopTerminalJob } from "../../lib/session-terminal.js";
import {
  listTrackedApps,
  listTrackedBackgroundJobs,
  subscribeTrackedTerminals,
  untrackApp,
  untrackBackgroundJob
} from "./tracked-terminals.js";
import {
  runningTerminalItemsFrom,
  type RunningTerminalItem
} from "./running-terminals.js";
import { requestOpenTerminalTab } from "./terminal-toggle.js";

function itemsForSession(sessionId: string): RunningTerminalItem[] {
  return runningTerminalItemsFrom({
    appTabs: listTrackedApps(sessionId).map((name) => {
      const slash = name.lastIndexOf("/");
      const label = slash >= 0 ? name.slice(slash + 1) : name;
      return {
        id: `app:${name}`,
        kind: "app",
        label,
        running: true
      };
    }),
    jobs: listTrackedBackgroundJobs(sessionId).map((name) => ({
      name,
      running: true
    }))
  });
}

async function stopTrackedItem(
  sessionId: string,
  item: RunningTerminalItem
): Promise<void> {
  if (item.kind === "app") {
    const name = item.id.slice("app:".length);
    await stopApp(sessionId, name);
    untrackApp(sessionId, name);
    return;
  }
  const name = item.id.slice("job:".length);
  await stopTerminalJob({ sessionId, name });
  untrackBackgroundJob(sessionId, name);
}

function runningCountLabel(count: number): string {
  return count === 1 ? "1 terminal running" : `${count} terminals running`;
}

function RunningTerminalRow(options: {
  item: RunningTerminalItem;
  stoppingId: string | null;
  onStop: (item: RunningTerminalItem) => void;
}) {
  const { item, stoppingId, onStop } = options;
  return (
    <li className="flex items-center gap-1 rounded hover:bg-muted">
      <button
        type="button"
        aria-label={`Open ${item.label} in terminal`}
        title={`Open ${item.label} in terminal`}
        onClick={() =>
          requestOpenTerminalTab({
            id: item.id,
            kind: item.kind
          })
        }
        className="flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-1 text-left text-[0.7rem] font-medium text-foreground"
      >
        <Terminal className="size-3 shrink-0 text-muted-foreground" />
        <span className="truncate">{item.label}</span>
      </button>
      <button
        type="button"
        aria-label={`Stop ${item.label}`}
        title={`Stop ${item.label}`}
        disabled={stoppingId === item.id}
        onClick={() => void onStop(item)}
        className="mr-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded text-red-600 hover:bg-background hover:text-red-700 disabled:opacity-40 dark:text-red-500 dark:hover:text-red-400"
      >
        <Square className="size-2.5 fill-current" />
      </button>
    </li>
  );
}

export function RunningTerminalsBar({ sessionId }: { sessionId: string }) {
  const [items, setItems] = useState<RunningTerminalItem[]>(() =>
    itemsForSession(sessionId)
  );
  const [expanded, setExpanded] = useState(false);
  const [stoppingId, setStoppingId] = useState<string | null>(null);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setItems(itemsForSession(sessionId));
    });
    return subscribeTrackedTerminals(() => {
      setItems(itemsForSession(sessionId));
    });
  }, [sessionId]);

  useEffect(() => {
    if (items.length === 0) {
      void Promise.resolve().then(() => {
        setExpanded(false);
      });
    }
  }, [items.length]);

  const onStop = useCallback(
    async (item: RunningTerminalItem) => {
      setStoppingId(item.id);
      try {
        await stopTrackedItem(sessionId, item);
      } catch {
        return;
      } finally {
        setStoppingId(null);
      }
    },
    [sessionId]
  );

  if (items.length === 0) return null;

  const countLabel = runningCountLabel(items.length);

  return (
    <div
      data-testid="running-terminals-bar"
      className="rounded-t-lg border border-b-0 border-border bg-background px-2 py-1.5"
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-1.5 text-left text-[0.7rem] font-medium text-foreground/80 hover:text-foreground"
      >
        {expanded ? (
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span>{countLabel}</span>
      </button>
      {expanded ? (
        <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto">
          {items.map((item) => (
            <RunningTerminalRow
              key={item.id}
              item={item}
              stoppingId={stoppingId}
              onStop={onStop}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
