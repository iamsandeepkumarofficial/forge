import { BASE_URL, ConnectProjectError } from "./shared.js";

export type WorkflowNodeState =
  | "done"
  | "executing"
  | "next"
  | "idle"
  | "failed"
  | "waiting";
export type WorkflowLifecycleStatus =
  | "running"
  | "completed"
  | "failed"
  | "terminated"
  | "not_started"
  | "unavailable";
export interface WorkflowNode {
  stageId: string;
  agentId: string;
  column: string;
  action: string;
  state: WorkflowNodeState;
  manual: boolean;
}
export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: Array<{
    from: string;
    to: string;
  }>;
  finished: boolean;
  workflow: {
    status: WorkflowLifecycleStatus;
    error?: string;
  };
}
export async function getWorkflow(
  projectId: string,
  chatId: string
): Promise<WorkflowGraph> {
  const response = await fetch(
    `${BASE_URL}/api/projects/${projectId}/chats/${chatId}/workflow`
  );
  if (!response.ok) {
    throw new ConnectProjectError("Failed to fetch workflow");
  }
  return response.json();
}
export interface StageMessage {
  role: string;
  parts: unknown[];
  createdAt?: string;
}
export interface StageMessagesResponse {
  stageId: string;
  agentId: string;
  mode: "auto" | "manual";
  sessionId?: string;
  ticketSessionId?: string;
  messages: StageMessage[];
}
export async function getStageMessages(options: {
  projectId: string;
  chatId: string;
  stageId: string;
}): Promise<StageMessagesResponse> {
  const { projectId, chatId, stageId } = options;
  const response = await fetch(
    `${BASE_URL}/api/projects/${projectId}/chats/${chatId}/workflow/stages/${stageId}/messages`
  );
  if (!response.ok) {
    throw new ConnectProjectError("Failed to fetch stage messages");
  }
  return response.json();
}
export interface WorkflowTranscriptStage {
  stageId: string;
  agentId: string;
  action: string;
  state: WorkflowNodeState;
  executed: boolean;
  model: {
    provider: string;
    name: string;
    baseUrl?: string;
    source?: string;
    reported?: {
      provider: string;
      modelId: string;
    };
  } | null;
  messages: StageMessage[];
  outputPreview: string | null;
  source: "session" | "comment";
}

export interface WorkflowTranscript {
  stages: WorkflowTranscriptStage[];
}
export async function getWorkflowTranscript(
  projectId: string,
  chatId: string
): Promise<WorkflowTranscript> {
  const response = await fetch(
    `${BASE_URL}/api/projects/${projectId}/chats/${chatId}/workflow/transcript`
  );
  if (!response.ok) {
    throw new ConnectProjectError("Failed to fetch workflow transcript");
  }
  return response.json();
}
export async function enterManualMode(options: {
  projectId: string;
  chatId: string;
  stageId: string;
}): Promise<void> {
  const { projectId, chatId, stageId } = options;
  const response = await fetch(
    `${BASE_URL}/api/projects/${projectId}/chats/${chatId}/workflow/stages/${stageId}/manual`,
    {
      method: "POST"
    }
  );
  if (!response.ok) {
    throw new ConnectProjectError("Failed to enter manual mode");
  }
}
export async function completeManualStage(options: {
  projectId: string;
  chatId: string;
  stageId: string;
}): Promise<void> {
  const { projectId, chatId, stageId } = options;
  const response = await fetch(
    `${BASE_URL}/api/projects/${projectId}/chats/${chatId}/workflow/stages/${stageId}/complete`,
    {
      method: "POST"
    }
  );
  if (!response.ok) {
    throw new ConnectProjectError("Failed to complete manual stage");
  }
}
export async function retryStage(options: {
  projectId: string;
  chatId: string;
  stageId: string;
}): Promise<void> {
  const { projectId, chatId, stageId } = options;
  const response = await fetch(
    `${BASE_URL}/api/projects/${projectId}/chats/${chatId}/workflow/stages/${stageId}/retry`,
    {
      method: "POST"
    }
  );
  if (!response.ok) {
    throw new ConnectProjectError("Failed to retry stage");
  }
}
export async function stopWorkflow(
  projectId: string,
  chatId: string
): Promise<void> {
  const response = await fetch(
    `${BASE_URL}/api/projects/${projectId}/chats/${chatId}/workflow/stop`,
    {
      method: "POST"
    }
  );
  if (!response.ok) {
    throw new ConnectProjectError("Failed to stop workflow");
  }
}
