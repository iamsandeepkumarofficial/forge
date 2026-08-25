import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "../lib/utils.js";
import { runnerUrl, pocToken, userEmailHeader } from "../lib/tool-runner.js";
import { formatTokens, N_100 } from "./chat-composer-shared.js";
import {
  buildUsageRows,
  estimateTokensFromText
} from "./context-usage-math.js";

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${pocToken()}`,
    ...(userEmailHeader() ?? {})
  };
}

async function fetchSystemPromptText(sessionId: string): Promise<string> {
  const res = await fetch(
    `${runnerUrl()}/internal/system-prompt?sessionId=${encodeURIComponent(sessionId)}`,
    { headers: authHeaders() }
  );
  if (!res.ok) return "";
  return (await res.text()) || "";
}

async function fetchToolDefinitionText(agentMode: string): Promise<string> {
  const res = await fetch(
    `${runnerUrl()}/internal/chat-tool-definitions?mode=${encodeURIComponent(agentMode)}`,
    { headers: authHeaders() }
  );
  if (!res.ok) return "";
  const body = (await res.json()) as { text?: string };
  return typeof body.text === "string" ? body.text : "";
}

export function ContextUsageRing(options: {
  ratio: number;
  open: boolean;
  onClick: () => void;
  className?: string;
}) {
  const { ratio, open, onClick, className } = options;
  const clamped = Math.max(0, Math.min(1, ratio));
  const r = 7;
  const c = 2 * Math.PI * r;
  const filled = clamped * c;
  return (
    <button
      type="button"
      onClick={onClick}
      title={open ? undefined : "Show context usage"}
      className={cn(
        "inline-flex items-center justify-center rounded-full p-1 hover:bg-muted/40 focus:outline-none",
        open && "bg-muted/40",
        className
      )}
      aria-label={`Context usage ${Math.round(clamped * N_100)}%`}
    >
      <svg
        viewBox="0 0 20 20"
        className="size-5 shrink-0 text-muted-foreground"
      >
        <circle
          cx="10"
          cy="10"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeWidth="2.5"
        />
        <circle
          cx="10"
          cy="10"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
          transform="rotate(-90 10 10)"
        />
      </svg>
    </button>
  );
}

export function useContextUsage(options: {
  sessionId: string;
  agentMode: string;
  conversationTokens: number;
  maxContextTokens: number | null;
  maxOutputTokens: number | null;
}) {
  const {
    sessionId,
    agentMode,
    conversationTokens,
    maxContextTokens,
    maxOutputTokens
  } = options;
  const [systemPromptText, setSystemPromptText] = useState("");
  const [systemPromptLoading, setSystemPromptLoading] = useState(false);
  const [toolDefinitionTokens, setToolDefinitionTokens] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setSystemPromptLoading(true);
        const [prompt, toolText] = await Promise.all([
          fetchSystemPromptText(sessionId),
          fetchToolDefinitionText(agentMode)
        ]);
        if (cancelled) return;
        setSystemPromptText(prompt);
        setToolDefinitionTokens(estimateTokensFromText(toolText));
      } catch {
        void 0;
      } finally {
        if (!cancelled) setSystemPromptLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [sessionId, agentMode]);
  return buildUsageRows({
    systemPromptText,
    systemPromptLoading,
    toolDefinitionTokens,
    conversationTokens,
    maxContextTokens,
    maxOutputTokens
  });
}

export function ContextUsagePopover(options: {
  percentFull: number;
  usageSubtitle: string;
  rows: Array<{ label: string; tokens: number; dot: string }>;
  onClose: () => void;
}) {
  const { percentFull, usageSubtitle, rows, onClose } = options;
  const barWidth = Math.max(0, Math.min(N_100, percentFull));
  return (
    <div className="absolute right-0 bottom-full mb-2 w-[340px] rounded-xl border border-border bg-background shadow-lg overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div>
          <div className="text-sm font-medium">Context Usage</div>
          <div className="text-xs text-muted-foreground">{usageSubtitle}</div>
        </div>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onClose}
          aria-label="Close context usage"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="px-4 py-3 space-y-3">
        <div className="h-3 w-full rounded bg-muted/60 overflow-hidden">
          <div
            className="h-full bg-primary/70"
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <div className="space-y-2 text-sm">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cn("size-3 rounded-sm", row.dot)}
                  aria-hidden
                />
                <span className="truncate text-muted-foreground">
                  {row.label}
                </span>
              </div>
              <div className="shrink-0 text-xs text-muted-foreground">
                {formatTokens(row.tokens)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
