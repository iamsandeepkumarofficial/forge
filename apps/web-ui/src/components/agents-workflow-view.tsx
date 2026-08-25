import { Link } from "react-router-dom";
import {
  Check,
  ChevronRight,
  ExternalLink,
  Loader2,
  RotateCcw,
  Square,
  X
} from "lucide-react";
import type {
  WorkflowGraph,
  WorkflowLifecycleStatus,
  WorkflowNode
} from "@/lib/projects-api";
import { Button } from "@/components/ui/button";

type DisplayState = WorkflowNode["state"] | "stopped";

export const STATE_CLASS: Record<DisplayState, string> = {
  executing:
    "border-green-600 bg-green-500/10 text-green-700 ring-2 ring-green-500/25 shadow-sm dark:text-green-400",
  waiting:
    "border-amber-500 bg-amber-500/10 text-amber-700 ring-2 ring-amber-500/25 shadow-sm dark:text-amber-400",
  failed: "border-border bg-background text-foreground",
  done: "border-border bg-background text-muted-foreground",
  stopped: "border-border bg-muted/30 text-muted-foreground",
  next: "border-border bg-muted/30 text-muted-foreground",
  idle: "border-border bg-muted/30 text-muted-foreground"
};

export const WORKFLOW_BANNER: Record<
  Exclude<WorkflowLifecycleStatus, "running">,
  string
> = {
  completed: "Pipeline completed.",
  failed: "Pipeline failed — retry a stage to resume.",
  terminated: "Pipeline stopped — retry a stage to resume.",
  not_started: "Pipeline has not started — retry a stage to begin.",
  unavailable: "Orchestration unavailable — agent status may be stale."
};

export function resolveDisplayState(
  node: WorkflowNode,
  running: boolean
): DisplayState {
  if (!running && (node.state === "executing" || node.state === "waiting")) {
    return "stopped";
  }
  return node.state;
}

export function canRetry(displayState: DisplayState): boolean {
  return (
    displayState === "done" ||
    displayState === "failed" ||
    displayState === "stopped"
  );
}

export function StageMarker({ state }: { state: DisplayState }) {
  if (state === "done") {
    return (
      <Check
        size={12}
        className="shrink-0 text-green-600 dark:text-green-500"
        aria-hidden
      />
    );
  }
  if (state === "failed") {
    return <X size={12} className="shrink-0 text-destructive" aria-hidden />;
  }
  if (state === "executing") {
    return (
      <span
        className="size-1.5 shrink-0 animate-pulse rounded-full bg-green-600 dark:bg-green-500"
        aria-hidden
      />
    );
  }
  if (state === "waiting") {
    return (
      <span
        className="size-1.5 shrink-0 animate-pulse rounded-full bg-amber-500"
        aria-hidden
      />
    );
  }
  return (
    <span
      className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40"
      aria-hidden
    />
  );
}

export function AgentsWorkflowView(options: {
  projectId: string;
  chatId: string;
  graph: WorkflowGraph;
  error: string | null;
  busyStageId: string | null;
  stopping: boolean;
  onRetry: (stageId: string) => void;
  onStop: (stageId: string) => void;
}) {
  const {
    projectId,
    chatId,
    graph,
    error,
    busyStageId,
    stopping,
    onRetry,
    onStop
  } = options;
  const workflowStatus = graph.workflow?.status ?? "unavailable";
  const isRunning = workflowStatus === "running";
  const showBanner = !isRunning;
  const bannerText =
    workflowStatus === "failed" || workflowStatus === "terminated"
      ? graph.workflow?.error
        ? `${WORKFLOW_BANNER[workflowStatus]} ${graph.workflow.error}`
        : WORKFLOW_BANNER[workflowStatus]
      : WORKFLOW_BANNER[
          workflowStatus as Exclude<WorkflowLifecycleStatus, "running">
        ];
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-base">Agents</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live pipeline status for this ticket. Retry a stage or stop the
            active agent from here.
          </p>
        </div>
        <Link
          to={`/projects/${projectId}/chats/${chatId}`}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-xs font-medium hover:bg-muted"
        >
          <ExternalLink size={14} />
          Enter Workbench
        </Link>
      </div>
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
      {showBanner && (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {bannerText}
        </div>
      )}
      <WorkflowStageRow
        graph={graph}
        isRunning={isRunning}
        busyStageId={busyStageId}
        stopping={stopping}
        onRetry={onRetry}
        onStop={onStop}
      />
      {graph.finished && isRunning && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <ExternalLink size={12} /> Workflow finished
        </p>
      )}
    </div>
  );
}

function WorkflowStageRow(options: {
  graph: WorkflowGraph;
  isRunning: boolean;
  busyStageId: string | null;
  stopping: boolean;
  onRetry: (stageId: string) => void;
  onStop: (stageId: string) => void;
}) {
  const { graph, isRunning, busyStageId, stopping, onRetry, onStop } = options;
  return (
    <div className="flex flex-wrap items-center gap-y-2">
      {graph.nodes.map((node, i) => {
        const displayState = resolveDisplayState(node, isRunning);
        const active =
          displayState === "executing" || displayState === "waiting";
        const showRetry = canRetry(displayState);
        const busy = busyStageId === node.stageId;
        const hasAction = active || showRetry;
        return (
          <div key={node.stageId} className="flex items-center">
            <div
              className={`flex items-center gap-1.5 rounded-full border py-1 pl-2.5 text-xs transition-colors ${hasAction ? "pr-1" : "pr-2.5"} ${STATE_CLASS[displayState]}`}
              title={node.manual ? `${node.agentId} · manual` : node.agentId}
            >
              <StageMarker state={displayState} />
              <span
                className={`max-w-30 truncate ${active ? "font-semibold" : "font-medium"}`}
              >
                {node.agentId}
              </span>
              {active ? (
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Stop ${node.agentId}`}
                  title={`Stop ${node.agentId}`}
                  disabled={busy || stopping}
                  onClick={() => onStop(node.stageId)}
                >
                  {busy ? <Loader2 className="animate-spin" /> : <Square />}
                </Button>
              ) : showRetry ? (
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="rounded-full"
                  aria-label={`Retry ${node.agentId}`}
                  title={`Retry ${node.agentId}`}
                  disabled={busy || stopping}
                  onClick={() => onRetry(node.stageId)}
                >
                  {busy ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                </Button>
              ) : null}
            </div>
            {i < graph.nodes.length - 1 && (
              <span
                className="mx-0.5 flex items-center text-muted-foreground/50"
                aria-hidden
              >
                <span className="h-px w-2.5 bg-current" />
                <ChevronRight size={12} className="-ml-1.5" />
              </span>
            )}
          </div>
        );
      })}
      {graph.nodes.length === 0 && (
        <p className="text-sm text-muted-foreground">No workflow stages</p>
      )}
    </div>
  );
}
