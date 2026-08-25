import type { WorkflowGraph } from "@/lib/projects-api";
import { AgentsWorkflowView } from "./agents-workflow-view.js";
import { useAgentsWorkflow } from "./use-agents-workflow.js";

interface AgentsWorkflowDiagramProps {
  projectId: string;
  chatId: string;
  onGraph?: (graph: WorkflowGraph) => void;
  pollMs?: number;
  initialGraph?: WorkflowGraph | null;
}

export function AgentsWorkflowDiagram(props: AgentsWorkflowDiagramProps) {
  const { projectId, chatId } = props;
  const state = useAgentsWorkflow(props);
  if (state.error && !state.graph) {
    return <div className="text-sm text-destructive">{state.error}</div>;
  }
  if (!state.graph) {
    return <div className="text-sm text-muted-foreground">Loading agents…</div>;
  }
  return (
    <AgentsWorkflowView
      projectId={projectId}
      chatId={chatId}
      graph={state.graph}
      error={state.error}
      busyStageId={state.busyStageId}
      stopping={state.stopping}
      onRetry={state.onRetry}
      onStop={state.onStop}
    />
  );
}
