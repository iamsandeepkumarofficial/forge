import { useEffect, useState } from "react";
import {
  fetchSessionHealth,
  type SessionHealthReport
} from "../../lib/tool-runner.js";
import { postAgentPrompt } from "./preview-comment-bus.js";
import { buildHealthFixPrompt, healthHasGaps } from "./health-format.js";

function healthDot(status: SessionHealthReport["overall"]): string {
  if (status === "ok") return "bg-green-500";
  if (status === "warn") return "bg-amber-500";
  if (status === "fail") return "bg-red-500";
  return "bg-muted-foreground/40";
}

function checkMark(status: SessionHealthReport["overall"]): string {
  if (status === "ok") return "✓";
  if (status === "fail") return "✕";
  if (status === "warn") return "!";
  return "·";
}

export function useSessionHealth(options: {
  sessionId: string;
  refreshKey?: number;
}) {
  const { sessionId, refreshKey = 0 } = options;
  const [report, setReport] = useState<SessionHealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    void fetchSessionHealth(sessionId)
      .then((r) => {
        if (!cancelled) {
          setReport(r);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, refreshKey]);
  return { report, error, loading };
}

export function requestHealthFix(options: {
  report: SessionHealthReport;
  onBeforeSend?: () => void;
}) {
  options.onBeforeSend?.();
  postAgentPrompt({
    text: buildHealthFixPrompt(options.report),
    replaceRunning: true
  });
}

function HealthCheckList(options: { report: SessionHealthReport }) {
  const { report } = options;
  return (
    <ul className="space-y-1.5">
      {report.checks.map((c) => (
        <li key={c.id} className="text-xs">
          <div className="flex items-start gap-1.5 text-muted-foreground">
            <span
              className={`mt-0.5 w-3 shrink-0 text-center font-mono text-[0.65rem] ${
                c.status === "ok"
                  ? "text-green-600 dark:text-green-400"
                  : c.status === "fail"
                    ? "text-destructive"
                    : "text-amber-600 dark:text-amber-400"
              }`}
              aria-hidden
            >
              {checkMark(c.status)}
            </span>
            <div className="min-w-0 flex-1">
              <span className="font-medium text-foreground">{c.label}</span>
              <span className="text-muted-foreground">
                {" "}
                — {c.summary.split("\n")[0]}
              </span>
              {c.items && c.items.length > 0 && (
                <ul className="mt-1 space-y-0.5 border-l border-border/60 pl-2">
                  {c.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start gap-1 text-[0.7rem] text-muted-foreground"
                    >
                      <span
                        className={`mt-0.5 w-3 shrink-0 text-center font-mono ${
                          item.status === "ok"
                            ? "text-green-600 dark:text-green-400"
                            : item.status === "fail"
                              ? "text-destructive"
                              : "text-amber-600 dark:text-amber-400"
                        }`}
                        aria-hidden
                      >
                        {checkMark(item.status)}
                      </span>
                      <span>
                        <span className="text-foreground/90">{item.label}</span>
                        {item.summary ? `: ${item.summary}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function HealthPanel(options: {
  sessionId: string;
  refreshKey?: number;

  showFix?: boolean;
  onBeforeFix?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const {
    sessionId,
    refreshKey = 0,
    showFix = true,
    onBeforeFix,
    className,
    compact
  } = options;
  const { report, error, loading } = useSessionHealth({
    sessionId,
    refreshKey
  });
  const gaps = healthHasGaps(report);

  return (
    <div className={className ?? "px-3 py-2"}>
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${healthDot(report?.overall ?? "unknown")}`}
        />
        <span className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
          Health
        </span>
        {showFix && gaps && report ? (
          <button
            type="button"
            onClick={() =>
              requestHealthFix({ report, onBeforeSend: onBeforeFix })
            }
            className="ml-auto rounded bg-primary px-2 py-0.5 text-[0.65rem] font-medium text-primary-foreground hover:opacity-90"
          >
            Fix
          </button>
        ) : null}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {report && <HealthCheckList report={report} />}
      {loading && !report && !error && (
        <p className="text-xs text-muted-foreground">Checking…</p>
      )}
      {!compact && report && report.overall === "ok" && (
        <p className="mt-2 text-[0.7rem] text-muted-foreground">
          No blockers detected.
        </p>
      )}
    </div>
  );
}

export function HealthIssuesBanner(options: {
  sessionId: string;
  onOpenHelp?: () => void;
}) {
  const { sessionId, onOpenHelp } = options;
  const { report, loading } = useSessionHealth({ sessionId });
  if (loading || !healthHasGaps(report) || !report) return null;
  const gapChecks = report.checks.filter((c) => c.status !== "ok");
  return (
    <div className="w-full max-w-sm rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2 text-left dark:border-amber-800 dark:bg-amber-950/40">
      <div className="mb-1.5 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${healthDot(report.overall)}`} />
        <span className="text-xs font-medium text-amber-900 dark:text-amber-100">
          Setup issues detected
        </span>
        <button
          type="button"
          onClick={() => requestHealthFix({ report })}
          className="ml-auto rounded bg-primary px-2 py-0.5 text-[0.65rem] font-medium text-primary-foreground"
        >
          Fix
        </button>
      </div>
      <ul className="space-y-1">
        {gapChecks.slice(0, 4).map((c) => (
          <li
            key={c.id}
            className="text-[0.7rem] text-amber-800 dark:text-amber-200"
          >
            <span className="font-medium">{c.label}</span>
            {" — "}
            {c.summary.split("\n")[0]}
          </li>
        ))}
      </ul>
      {onOpenHelp ? (
        <button
          type="button"
          onClick={onOpenHelp}
          className="mt-2 text-[0.7rem] text-primary hover:underline"
        >
          View full checklist
        </button>
      ) : null}
    </div>
  );
}
