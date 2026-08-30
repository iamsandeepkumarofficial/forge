import { useState, useEffect, useRef, useCallback } from "react";
import { Square } from "lucide-react";
import { fetchAllAppLogs } from "../../lib/tool-runner.js";
import {
  fetchAllTerminalLogs,
  runTerminalCommand,
  stopTerminalJob
} from "../../lib/session-terminal.js";
import { useApps } from "./use-apps.js";
import {
  appLogsByStream,
  buildAppStreams,
  buildJobStreams,
  countRunningStreams,
  formatShellEntry,
  jobLogsByStream,
  jobNameFromCommand,
  shouldRunInBackground,
  type TerminalStream
} from "./terminal-model.js";

const N_3000 = 3000;
const SHELL_ID = "shell";

const STREAM_COLORS = [
  "text-blue-400",
  "text-green-400",
  "text-purple-400",
  "text-amber-400",
  "text-pink-400",
  "text-cyan-400",
  "text-orange-400"
];

export type { TerminalStream };

type LogLine = {
  key: string;
  streamId: string;
  label: string;
  color: string;
  text: string;
};

function buildLogLines(options: {
  streams: TerminalStream[];
  excluded: Set<string>;
  logsById: Record<string, string>;
  query: string;
  colorOf: (id: string) => string;
}): LogLine[] {
  const { streams, excluded, logsById, query, colorOf } = options;
  const q = query.trim().toLowerCase();
  const lines: LogLine[] = [];
  for (const stream of streams) {
    if (excluded.has(stream.id)) continue;
    const split = (logsById[stream.id] ?? "").split("\n");
    split.forEach((text, i) => {
      if (text === "") return;
      if (
        q &&
        !text.toLowerCase().includes(q) &&
        !stream.label.toLowerCase().includes(q)
      ) {
        return;
      }
      lines.push({
        key: `${stream.id}:${i}`,
        streamId: stream.id,
        label: stream.label,
        color: colorOf(stream.id),
        text
      });
    });
  }
  return lines;
}

function useTerminalStreams(
  sessionId: string,
  shellLog: string,
  refresh: number
): {
  streams: TerminalStream[];
  logsById: Record<string, string>;
} {
  const { apps } = useApps(sessionId);
  const [jobState, setJobState] = useState<{
    streams: TerminalStream[];
    logs: Record<string, string>;
  }>({ streams: [], logs: {} });
  const [appLogs, setAppLogs] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const [nextAppLogs, term] = await Promise.all([
          fetchAllAppLogs(sessionId).catch(() => ({})),
          fetchAllTerminalLogs(sessionId).catch(() => ({
            jobs: [],
            logs: {}
          }))
        ]);
        if (cancelled) return;
        setAppLogs(appLogsByStream(nextAppLogs));
        setJobState({
          streams: buildJobStreams(term.jobs),
          logs: jobLogsByStream(term.logs)
        });
      } catch {
        if (!cancelled) {
          setAppLogs({});
          setJobState({ streams: [], logs: {} });
        }
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), N_3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [sessionId, refresh]);
  const streams = [
    ...buildAppStreams(apps),
    ...jobState.streams,
    ...(shellLog
      ? [{ id: SHELL_ID, label: "shell", running: false }]
      : [])
  ];
  return {
    streams,
    logsById: { ...appLogs, ...jobState.logs, [SHELL_ID]: shellLog }
  };
}

export function TerminalPane(options: {
  sessionId: string;
  onRunningCount?: (count: number) => void;
}) {
  const { sessionId, onRunningCount } = options;
  const [shellLog, setShellLog] = useState("");
  const [refresh, setRefresh] = useState(0);
  const { streams, logsById } = useTerminalStreams(
    sessionId,
    shellLog,
    refresh
  );
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const running = countRunningStreams(streams);
  useEffect(() => {
    onRunningCount?.(running);
  }, [onRunningCount, running]);
  const colorOf = useCallback(
    (id: string) =>
      STREAM_COLORS[
        Math.max(
          0,
          streams.findIndex((s) => s.id === id)
        ) % STREAM_COLORS.length
      ]!,
    [streams]
  );
  const lines = buildLogLines({
    streams,
    excluded,
    logsById,
    query,
    colorOf
  });
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);
  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const onStop = async (id: string) => {
    if (!id.startsWith("job:")) return;
    await stopTerminalJob(sessionId, id.slice("job:".length));
    setRefresh((n) => n + 1);
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <StreamFilters
        streams={streams}
        excluded={excluded}
        query={query}
        colorOf={colorOf}
        onToggle={toggle}
        onStop={(id) => void onStop(id)}
        onQueryChange={setQuery}
      />
      <LogLines scrollRef={scrollRef} lines={lines} empty={streams.length === 0} />
      <CommandBar
        sessionId={sessionId}
        onOutput={(text) => {
          setShellLog((prev) => (prev ? `${prev}\n${text}` : text));
          setRefresh((n) => n + 1);
        }}
      />
    </div>
  );
}

function CommandBar(options: {
  sessionId: string;
  onOutput: (text: string) => void;
}) {
  const { sessionId, onOutput } = options;
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState(false);
  const [background, setBackground] = useState(false);
  const autoBg = shouldRunInBackground(command);
  const runBackground = background || autoBg;
  const submit = async () => {
    const next = command.trim();
    if (!next || busy) return;
    setBusy(true);
    try {
      const result = await runTerminalCommand({
        sessionId,
        command: next,
        background: runBackground,
        jobName: runBackground ? jobNameFromCommand(next) : undefined
      });
      onOutput(formatShellEntry(next, result.output));
      setCommand("");
    } catch (err) {
      onOutput(
        formatShellEntry(
          next,
          err instanceof Error ? err.message : String(err)
        )
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="flex items-center gap-1.5 border-t px-2 py-1"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <span className="font-mono text-[0.7rem] text-muted-foreground">$</span>
      <input
        aria-label="Run command"
        value={command}
        disabled={busy}
        onChange={(e) => setCommand(e.target.value)}
        placeholder="ls, pnpm test, curl …  (dev servers → Run)"
        className="min-w-0 flex-1 bg-transparent font-mono text-[0.7rem] outline-none"
      />
      <label className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
        <input
          type="checkbox"
          aria-label="Run in background"
          checked={runBackground}
          disabled={autoBg}
          onChange={(e) => setBackground(e.target.checked)}
        />
        Bg
      </label>
      <button
        type="submit"
        disabled={busy || !command.trim()}
        className="rounded border px-1.5 py-0.5 text-[0.65rem] disabled:opacity-40"
      >
        {busy ? "…" : "Run"}
      </button>
    </form>
  );
}

function StreamFilters(options: {
  streams: TerminalStream[];
  excluded: Set<string>;
  query: string;
  colorOf: (id: string) => string;
  onToggle: (id: string) => void;
  onStop: (id: string) => void;
  onQueryChange: (value: string) => void;
}) {
  const {
    streams,
    excluded,
    query,
    colorOf,
    onToggle,
    onStop,
    onQueryChange
  } = options;
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b px-2 py-1">
      {streams.map((s) => {
        const on = !excluded.has(s.id);
        return (
          <span
            key={s.id}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] ${on ? "bg-muted" : "text-muted-foreground opacity-50"}`}
          >
            <button
              type="button"
              onClick={() => onToggle(s.id)}
              title={s.command ?? (on ? "Click to hide" : "Click to show")}
            >
              <span
                className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${s.running ? "bg-green-500" : colorOf(s.id).replace("text-", "bg-")}`}
              />
              {s.label}
            </button>
            {s.stoppable && s.running ? (
              <button
                type="button"
                aria-label={`Stop ${s.label}`}
                title="Stop job"
                onClick={() => onStop(s.id)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Square className="size-2.5 fill-current" />
              </button>
            ) : null}
          </span>
        );
      })}
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="filter…"
        className="ml-auto w-28 rounded border bg-background px-1.5 py-0.5 text-[0.7rem]"
      />
    </div>
  );
}

function LogLines(options: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  lines: LogLine[];
  empty: boolean;
}) {
  const { scrollRef, lines, empty } = options;
  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-auto bg-gray-950 p-2 font-mono text-[0.7rem] text-gray-100"
    >
      {lines.length === 0 ? (
        <span className="text-gray-500">
          {empty
            ? "No output yet. Start an app from Run, or type a command below."
            : "No output yet."}
        </span>
      ) : (
        lines.map((l) => (
          <div key={l.key} className="whitespace-pre-wrap">
            <span className={`mr-2 ${l.color}`}>[{l.label}]</span>
            {l.text}
          </div>
        ))
      )}
    </div>
  );
}
