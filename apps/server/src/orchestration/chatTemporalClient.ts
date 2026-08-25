import type { AgentMode } from "@forge/core";
import { randomUUID } from "node:crypto";
import { Client, Connection, WorkflowIdReusePolicy } from "@temporalio/client";

const ADDRESS = process.env.TEMPORAL_ADDRESS || "localhost:7233";
const NAMESPACE = process.env.TEMPORAL_NAMESPACE || "default";
const TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE || "forge-orchestrator";

let clientPromise: Promise<Client> | null = null;

async function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const connection = await Connection.connect({ address: ADDRESS });
      return new Client({ connection, namespace: NAMESPACE });
    })();
  }
  return clientPromise;
}

function resetClient(): void {
  clientPromise = null;
}

export type ChatTurnOptions = {
  sessionId: string;
  turnId: string;
  userText: string;
  mode: AgentMode | "plan" | "build";
  provider: string;
  model?: string;
  reasoningEffort?: "low" | "medium" | "high";
};

export async function startInteractiveChatTurn(
  options: ChatTurnOptions
): Promise<string> {
  const workflowId = `chat-${options.sessionId}-${options.turnId}`;
  const client = await getClient();
  try {
    await client.workflow.start("interactiveChatTurnWorkflow", {
      taskQueue: TASK_QUEUE,
      workflowId,
      workflowIdReusePolicy:
        WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_REJECT_DUPLICATE,
      args: [options]
    });
  } catch (err) {
    resetClient();
    throw err;
  }
  return workflowId;
}

export async function cancelInteractiveChatTurn(
  workflowId: string
): Promise<void> {
  const client = await getClient();
  try {
    await client.workflow.getHandle(workflowId).cancel();
  } catch (err) {
    resetClient();
    throw err;
  }
}

export function newTurnId(): string {
  return randomUUID();
}
