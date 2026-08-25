import { useState, useEffect, useRef, useCallback } from "react";
import { fetchAllAppLogs } from "../../lib/tool-runner.js";
import { useApps } from "./use-apps.js";

const N_3000 = 3000;

const STREAM_COLORS = [
  "text-blue-400",
  "text-green-400",
  "text-purple-400",
  "text-amber-400",
  "text-pink-400",
  "text-cyan-400",
  "text-orange-400"
];

export type TerminalStream = {
  id: string;
  label: string;
  running: boolean;
};

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

function useTerminalStreams(sessionId: string): {
  streams: TerminalStream[];
  logsById: Record<string, string>;
} {
  const { apps } = useApps(sessionId);
  const [logsById, setLogsById] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const appLogs = await fetchAllAppLogs(sessionId).catch(() => ({}));
        if (cancelled) return;
        setLogsById(appLogsByStream(appLogs));
      } catch {
        if (!cancelled) setLogsById({});
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), N_3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [sessionId]);
  return { streams: buildAppStreams(apps), logsById };
}

export function TerminalPane({ sessionId }: { sessionId: string }) {
  const { streams, logsById } = useTerminalStreams(sessionId);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
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
  if (streams.length === 0) {
    return (
      <p className="p-3 text-xs text-muted-foreground">
        No terminal output yet. Start an app from Run.
      </p>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <StreamFilters
        streams={streams}
        excluded={excluded}
        query={query}
        colorOf={colorOf}
        onToggle={toggle}
        onQueryChange={setQuery}
      />
      <LogLines scrollRef={scrollRef} lines={lines} />
    </div>
  );
}

function appLogsByStream(
  appLogs: Record<string, string>
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [name, text] of Object.entries(appLogs)) {
    next[`app:${name}`] = text;
  }
  return next;
}

function buildAppStreams(
  apps: Array<{ name: string; running: boolean }>
): TerminalStream[] {
  return apps.map((a) => ({
    id: `app:${a.name}`,
    label: a.name,
    running: a.running
  }));
}

function StreamFilters(options: {
  streams: TerminalStream[];
  excluded: Set<string>;
  query: string;
  colorOf: (id: string) => string;
  onToggle: (id: string) => void;
  onQueryChange: (value: string) => void;
}) {
  const { streams, excluded, query, colorOf, onToggle, onQueryChange } =
    options;
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b px-2 py-1">
      {streams.map((s) => {
        const on = !excluded.has(s.id);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onToggle(s.id)}
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] ${on ? "bg-muted" : "text-muted-foreground opacity-50"}`}
            title={on ? "Click to hide" : "Click to show"}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${s.running ? "bg-green-500" : colorOf(s.id).replace("text-", "bg-")}`}
            />
            {s.label}
          </button>
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
}) {
  const { scrollRef, lines } = options;
  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-auto bg-gray-950 p-2 font-mono text-[0.7rem] text-gray-100"
    >
      {lines.length === 0 ? (
        <span className="text-gray-500">No output yet.</span>
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
