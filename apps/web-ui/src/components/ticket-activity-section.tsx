import { useEffect, useState } from "react";
import {
  getActivity,
  type ActivityEntry,
  type ActivityFilter
} from "@/lib/projects-api";
import { AssistantMarkdown } from "@/components/assistant-markdown";

const N_400 = 400;

const TABS: {
  id: ActivityFilter;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "comments", label: "Comments" },
  { id: "history", label: "History" },
  { id: "worklog", label: "Work Log" }
];
interface TicketActivitySectionProps {
  projectId: string;
  chatId: string;
}
function looksLikeMarkdown(text: string): boolean {
  return /(?:^|\n)#{1,6}\s|(?:^|\n)[-*+]\s|(?:^|\n)\d+\.\s|```|\*\*|__|\[.+\]\(.+\)/.test(
    text
  );
}
function ActivityBody({ entry }: { entry: ActivityEntry }) {
  const text = entry.summary ?? "";
  const rich =
    entry.kind === "comment" ||
    entry.kind === "worklog" ||
    looksLikeMarkdown(text);
  if (!rich) {
    return <div className="mt-1 text-sm leading-relaxed">{text}</div>;
  }
  return (
    <div className="mt-1 text-sm [&_.prose]:max-w-none">
      <AssistantMarkdown text={text} />
    </div>
  );
}
export function TicketActivitySection({
  projectId,
  chatId
}: TicketActivitySectionProps) {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestKey, setRequestKey] = useState(
    `${projectId}:${chatId}:${filter}`
  );
  if (requestKey !== `${projectId}:${chatId}:${filter}`) {
    setRequestKey(`${projectId}:${chatId}:${filter}`);
    setLoading(true);
  }
  useEffect(() => {
    let cancelled = false;
    void getActivity({ projectId, chatId, filter })
      .then((feed) => {
        if (!cancelled) {
          setEntries(feed.entries);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load activity"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, chatId, filter]);
  return (
    <ActivityFeedView
      filter={filter}
      entries={entries}
      expanded={expanded}
      error={error}
      loading={loading}
      onFilter={setFilter}
      onToggle={(id, open) => setExpanded((prev) => ({ ...prev, [id]: !open }))}
    />
  );
}
function ActivityEntryList(options: {
  entries: ActivityEntry[];
  expanded: Record<string, boolean>;
  onToggle: (id: string, open: boolean | undefined) => void;
}) {
  const { entries, expanded, onToggle } = options;
  return (
    <ul className="space-y-3">
      {entries.map((entry) => {
        const open = expanded[entry.id];
        const longComment =
          (entry.kind === "comment" || entry.kind === "worklog") &&
          entry.summary.length > N_400;
        return (
          <li
            key={entry.id}
            className="rounded-lg border border-border px-3 py-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs text-muted-foreground capitalize">
                {entry.kind}
                {entry.agentId ? ` · ${entry.agentId}` : ""}
                {" · "}
                {new Date(entry.createdAt).toLocaleString()}
              </div>
              {(entry.detail != null || longComment) && (
                <button
                  type="button"
                  className="text-xs text-primary shrink-0"
                  onClick={() => onToggle(entry.id, open)}
                >
                  {open ? "Collapse" : "Expand"}
                </button>
              )}
            </div>
            <div
              className={
                longComment && !open
                  ? "max-h-40 overflow-hidden relative"
                  : undefined
              }
            >
              <ActivityBody entry={entry} />
              {longComment && !open && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent" />
              )}
            </div>
            {open && entry.detail != null && (
              <pre className="mt-2 text-xs whitespace-pre-wrap bg-muted/40 rounded p-2 overflow-x-auto">
                {JSON.stringify(entry.detail, null, 2)}
              </pre>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ActivityFeedView(options: {
  filter: ActivityFilter;
  entries: ActivityEntry[];
  expanded: Record<string, boolean>;
  error: string | null;
  loading: boolean;
  onFilter: (f: ActivityFilter) => void;
  onToggle: (id: string, open: boolean | undefined) => void;
}) {
  const { filter, entries, expanded, error, loading, onFilter, onToggle } =
    options;
  return (
    <div className="space-y-3 border-t pt-4">
      <h3 className="font-semibold text-base">Activity</h3>
      <div className="flex flex-wrap gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onFilter(tab.id)}
            className={`rounded px-2.5 py-1 text-xs border ${
              filter === tab.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-transparent hover:bg-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && entries.length === 0 && (
        <p className="text-sm text-muted-foreground">No activity yet</p>
      )}
      <ActivityEntryList
        entries={entries}
        expanded={expanded}
        onToggle={onToggle}
      />
    </div>
  );
}
