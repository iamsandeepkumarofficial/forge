import { useEffect, useState } from "react";
import { Bot, ChevronDown, ChevronRight, History } from "lucide-react";
import { AssistantMarkdown } from "@/components/assistant-markdown";
import { ToolCalls } from "@/components/tool-calls";
import { toolPartsOf } from "@/lib/tool-display";
import {
  getWorkflowTranscript,
  type StageMessage,
  type WorkflowTranscriptStage
} from "@/lib/projects-api";
function partsToText(parts: unknown): string {
  if (typeof parts === "string") return parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p) => {
      if (p && typeof p === "object" && "text" in p && "type" in p) {
        const part = p as {
          type: unknown;
          text?: unknown;
        };
        if (part.type === "text") return String(part.text ?? "");
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}
function modelLabel(stage: WorkflowTranscriptStage): string | null {
  if (!stage.model) return null;
  const reported = stage.model.reported?.modelId;
  if (reported && reported !== stage.model.name) {
    return `${stage.model.provider}/${stage.model.name} (${reported})`;
  }
  return `${stage.model.provider}/${stage.model.name}`;
}
function MessageBubble({ message }: { message: StageMessage }) {
  const text = partsToText(message.parts);
  const tools = toolPartsOf(message.parts);
  if (message.role === "system") {
    if (!text) return null;
    return <p className="text-[11px] text-muted-foreground italic">{text}</p>;
  }
  if (message.role === "user") {
    return (
      <div className="rounded-lg border border-border bg-background px-3 py-2">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Prompt
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
      </div>
    );
  }
  if (message.role === "assistant") {
    return (
      <div className="rounded-lg bg-muted px-3 py-2">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {tools.length > 0 ? "Steps & output" : "Output"}
        </div>
        {text ? (
          <AssistantMarkdown text={text} streamingIndicator={false} />
        ) : null}
        <ToolCalls parts={tools} />
      </div>
    );
  }
  if (message.role === "tool") {
    return <ToolCalls parts={toolPartsOf(message.parts)} />;
  }
  return null;
}
function StageBlock({
  stage,
  defaultOpen
}: {
  stage: WorkflowTranscriptStage;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const model = modelLabel(stage);
  const isHistorical = stage.source === "comment";
  const visibleMessages = stage.messages.filter(
    (m) => m.role !== "system" || partsToText(m.parts).length > 0
  );
  const hasTranscript = visibleMessages.length > 0;
  const hasOutput = Boolean(stage.outputPreview?.trim());
  return (
    <section className="rounded-lg border border-border bg-background/60">
      <button
        type="button"
        className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/40"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Bot size={14} className="text-primary shrink-0" />
        <span className="font-medium truncate">{stage.agentId}</span>
        <span className="text-[11px] text-muted-foreground capitalize shrink-0">
          {stage.state}
        </span>
        {model && (
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {model}
          </span>
        )}
        {isHistorical && (
          <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
            <History size={10} />
            historical output only
          </span>
        )}
      </button>
      {open && (
        <div className="space-y-2 border-t border-border px-3 py-2.5">
          {hasTranscript ? (
            visibleMessages.map((message, i) => (
              <MessageBubble key={`${stage.stageId}-${i}`} message={message} />
            ))
          ) : hasOutput ? (
            <div className="rounded-lg bg-muted px-3 py-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Output
              </div>
              <AssistantMarkdown
                text={stage.outputPreview ?? ""}
                streamingIndicator={false}
              />
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
interface StagePipelineTranscriptProps {
  projectId: string;
  chatId: string;
  pollMs?: number;
}
export function StagePipelineTranscript({
  projectId,
  chatId,
  pollMs = 4000
}: StagePipelineTranscriptProps) {
  const [stages, setStages] = useState<WorkflowTranscriptStage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await getWorkflowTranscript(projectId, chatId);
        if (!cancelled) {
          setStages(next.stages);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load agent transcript"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const id = window.setInterval(() => void load(), pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [projectId, chatId, pollMs]);
  if (loading && stages.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground">
        Loading agent runs…
      </p>
    );
  }
  if (error && stages.length === 0) {
    return <p className="px-3 py-2 text-xs text-destructive">{error}</p>;
  }
  if (stages.length === 0) {
    return null;
  }
  const firstWithContent = stages.findIndex(
    (s) => s.messages.length > 0 || Boolean(s.outputPreview?.trim())
  );
  const activeIdx = stages.findIndex(
    (s) =>
      s.state === "executing" || s.state === "waiting" || s.state === "failed"
  );
  const defaultOpenIdx =
    activeIdx >= 0 ? activeIdx : firstWithContent >= 0 ? firstWithContent : 0;
  return (
    <StagePipelineList
      stages={stages}
      error={error}
      defaultOpenIdx={defaultOpenIdx}
    />
  );
}
function StagePipelineList(options: {
  stages: WorkflowTranscriptStage[];
  error: string | null;
  defaultOpenIdx: number;
}) {
  const { stages, error, defaultOpenIdx } = options;
  return (
    <div className="space-y-2 border-b border-border px-3 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Agent pipeline
        </h3>
        <span className="text-[11px] text-muted-foreground">
          Prompt · steps · output per stage
        </span>
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      <div className="space-y-1.5">
        {stages.map((stage, i) => (
          <StageBlock
            key={stage.stageId}
            stage={stage}
            defaultOpen={i === defaultOpenIdx}
          />
        ))}
      </div>
    </div>
  );
}
