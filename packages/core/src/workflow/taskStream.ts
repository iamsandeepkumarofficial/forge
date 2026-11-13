export const AGENT_TASK_STREAM_WORKFLOW_PREFIX = "agent-task-stream-";

export function isAgentTaskStreamWorkflowId(workflowId: string): boolean {
  return workflowId.startsWith(AGENT_TASK_STREAM_WORKFLOW_PREFIX);
}
