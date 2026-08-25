import { useEffect, useState } from "react";
import {
  getWorkflow,
  retryStage,
  stopWorkflow,
  type WorkflowGraph
} from "@/lib/projects-api";

const DEFAULT_POLL_MS = 3000;

function useAgentsWorkflowPoll(options: {
  projectId: string;
  chatId: string;
  onGraph?: (graph: WorkflowGraph) => void;
  pollMs: number;
  initialGraph: WorkflowGraph | null;
  setGraph: (g: WorkflowGraph | null) => void;
  setError: (e: string | null) => void;
}) {
  const {
    projectId,
    chatId,
    onGraph,
    pollMs,
    initialGraph,
    setGraph,
    setError
  } = options;
  useEffect(() => {
    if (initialGraph) {
      onGraph?.(initialGraph);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const next = await getWorkflow(projectId, chatId);
        if (!cancelled) {
          setGraph(next);
          setError(null);
          onGraph?.(next);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load workflow"
          );
        }
      }
    };
    void load();
    const id = window.setInterval(() => void load(), pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [projectId, chatId, pollMs, initialGraph, onGraph, setGraph, setError]);
}

export function useAgentsWorkflow(options: {
  projectId: string;
  chatId: string;
  onGraph?: (graph: WorkflowGraph) => void;
  pollMs?: number;
  initialGraph?: WorkflowGraph | null;
}) {
  const {
    projectId,
    chatId,
    onGraph,
    pollMs = DEFAULT_POLL_MS,
    initialGraph = null
  } = options;
  const [graph, setGraph] = useState<WorkflowGraph | null>(initialGraph);
  const [error, setError] = useState<string | null>(null);
  const [busyStageId, setBusyStageId] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  useAgentsWorkflowPoll({
    projectId,
    chatId,
    onGraph,
    pollMs,
    initialGraph,
    setGraph,
    setError
  });
  const runStageAction = async (actionOptions: {
    stageId: string;
    action: () => Promise<unknown>;
    failMessage: string;
    markStopping?: boolean;
  }) => {
    if (actionOptions.markStopping) setStopping(true);
    setBusyStageId(actionOptions.stageId);
    setError(null);
    try {
      await actionOptions.action();
      const next = await getWorkflow(projectId, chatId);
      setGraph(next);
      onGraph?.(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : actionOptions.failMessage);
    } finally {
      if (actionOptions.markStopping) setStopping(false);
      setBusyStageId(null);
    }
  };
  return {
    graph,
    error,
    busyStageId,
    stopping,
    onRetry: (stageId: string) =>
      void runStageAction({
        stageId,
        action: () => retryStage({ projectId, chatId, stageId }),
        failMessage: "Failed to retry stage"
      }),
    onStop: (stageId: string) =>
      void runStageAction({
        stageId,
        action: () => stopWorkflow(projectId, chatId),
        failMessage: "Failed to stop workflow",
        markStopping: true
      })
  };
}
