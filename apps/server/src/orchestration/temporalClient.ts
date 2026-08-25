import {
  Client,
  Connection,
  WorkflowIdConflictPolicy,
  WorkflowIdReusePolicy,
  WorkflowNotFoundError
} from "@temporalio/client";

const ADDRESS = process.env.TEMPORAL_ADDRESS || "localhost:7233";
const NAMESPACE = process.env.TEMPORAL_NAMESPACE || "default";
const TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE || "forge-orchestrator";

function enabled(): boolean {
  const primary = process.env.WORKFLOW_ORCHESTRATION_ENABLED;
  if (primary !== undefined && primary !== "") {
    return primary === "true";
  }
  return process.env.SDLC_ORCHESTRATION_ENABLED === "true";
}

function workflowId(cardId: string): string {
  return `pipeline-${cardId}`;
}

function legacyWorkflowId(cardId: string): string {
  return `sdlc-${cardId}`;
}

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

function warn(context: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.warn(`[orchestration] ${context}: ${message}`);
  clientPromise = null;
}

function isWorkflowNotFound(err: unknown): boolean {
  return err instanceof WorkflowNotFoundError;
}

export interface StageState {
  currentStageId: string | null;
  completedStageIds: string[];
  nextStageId: string | null;
  manualStageIds: string[];
  finished: boolean;
  failedStageId: string | null;
  lastError: string | null;
  waitingFor: "manual" | "human_gate" | null;
}

export type WorkflowLifecycleStatus =
  | "running"
  | "completed"
  | "failed"
  | "terminated"
  | "not_started"
  | "unavailable";

export interface WorkflowDescription {
  status: WorkflowLifecycleStatus;
  error?: string;
}

const IDLE_STATE: StageState = {
  currentStageId: null,
  completedStageIds: [],
  nextStageId: null,
  manualStageIds: [],
  finished: false,
  failedStageId: null,
  lastError: null,
  waitingFor: null
};

async function getHandle(cardId: string) {
  const client = await getClient();
  const primary = client.workflow.getHandle(workflowId(cardId));
  try {
    await primary.describe();
    return primary;
  } catch (err) {
    if (!isWorkflowNotFound(err)) throw err;
    return client.workflow.getHandle(legacyWorkflowId(cardId));
  }
}

function statusFromDescribe(name: string): WorkflowDescription {
  switch (name) {
    case "RUNNING":
      return { status: "running" };
    case "COMPLETED":
      return { status: "completed" };
    case "FAILED":
      return { status: "failed", error: "Workflow failed" };
    case "TERMINATED":
      return { status: "terminated" };
    case "TIMED_OUT":
      return { status: "failed", error: "Workflow timed out" };
    case "CANCELLED":
      return { status: "terminated" };
    default:
      return { status: "unavailable" };
  }
}

export async function startPipelineWorkflow(cardId: string): Promise<void> {
  if (!enabled()) return;
  try {
    const client = await getClient();
    await client.workflow.start("pipelineWorkflow", {
      taskQueue: TASK_QUEUE,
      workflowId: workflowId(cardId),
      workflowIdReusePolicy:
        WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_REJECT_DUPLICATE,
      args: [cardId]
    });
    console.log(`[orchestration] started ${workflowId(cardId)}`);
  } catch (err) {
    if (
      err instanceof Error &&
      err.constructor?.name === "WorkflowExecutionAlreadyStartedError"
    ) {
      return;
    }
    warn(`startPipelineWorkflow(${cardId}) skipped`, err);
  }
}

export const startSdlcWorkflow = startPipelineWorkflow;

export async function signalBoardAdvance(options: {
  cardId: string;
  from: string;
  to: string;
}): Promise<void> {
  const { cardId, from, to } = options;
  if (!enabled()) return;
  try {
    await (await getHandle(cardId)).signal("advance", { from, to });
    console.log(
      `[orchestration] signaled advance ${from}→${to} → ${workflowId(cardId)}`
    );
  } catch (err) {
    warn(`signalBoardAdvance(${cardId}) skipped`, err);
  }
}

export async function describePipelineWorkflow(
  cardId: string
): Promise<WorkflowDescription> {
  if (!enabled()) {
    return { status: "unavailable" };
  }
  try {
    const desc = await (await getHandle(cardId)).describe();
    return statusFromDescribe(desc.status.name);
  } catch (err) {
    if (isWorkflowNotFound(err)) {
      return { status: "not_started" };
    }
    warn(`describePipelineWorkflow(${cardId}) skipped`, err);
    return { status: "unavailable" };
  }
}

export const describeSdlcWorkflow = describePipelineWorkflow;

export async function queryWorkflowState(
  cardId: string
): Promise<StageState | null> {
  if (!enabled()) return null;
  try {
    const state = await (
      await getHandle(cardId)
    ).query<StageState>("stageState");
    return state ?? IDLE_STATE;
  } catch (err) {
    warn(`queryWorkflowState(${cardId}) skipped`, err);
    return null;
  }
}

export async function enterManualMode(
  cardId: string,
  stageId: string
): Promise<void> {
  if (!enabled()) return;
  try {
    await (await getHandle(cardId)).signal("enterManualMode", { stageId });
    console.log(
      `[orchestration] signaled enterManualMode ${stageId} → ${workflowId(cardId)}`
    );
  } catch (err) {
    warn(`enterManualMode(${cardId}, ${stageId}) skipped`, err);
  }
}

export async function completeManualStage(
  cardId: string,
  stageId: string
): Promise<void> {
  if (!enabled()) return;
  try {
    await (
      await getHandle(cardId)
    ).signal("completeManualStage", {
      stageId
    });
    console.log(
      `[orchestration] signaled completeManualStage ${stageId} → ${workflowId(cardId)}`
    );
  } catch (err) {
    warn(`completeManualStage(${cardId}, ${stageId}) skipped`, err);
  }
}

export async function retryStage(
  cardId: string,
  stageId: string
): Promise<void> {
  if (!enabled()) {
    throw new Error("Orchestration is not enabled");
  }
  const lifecycle = await describePipelineWorkflow(cardId);
  const client = await getClient();
  if (lifecycle.status === "running") {
    await (await getHandle(cardId)).signal("retryStage", { stageId });
    console.log(
      `[orchestration] signaled retryStage ${stageId} → ${workflowId(cardId)}`
    );
    return;
  }
  await client.workflow.start("pipelineWorkflow", {
    taskQueue: TASK_QUEUE,
    workflowId: workflowId(cardId),
    workflowIdReusePolicy:
      WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_ALLOW_DUPLICATE,
    workflowIdConflictPolicy: WorkflowIdConflictPolicy.FAIL,
    args: [{ cardId, startStageId: stageId }]
  });
  console.log(
    `[orchestration] restarted ${workflowId(cardId)} from stage ${stageId}`
  );
}

export async function stopPipelineWorkflow(cardId: string): Promise<void> {
  if (!enabled()) {
    throw new Error("Orchestration is not enabled");
  }
  try {
    await (await getHandle(cardId)).terminate("stopped from ticket detail");
    console.log(`[orchestration] terminated ${workflowId(cardId)}`);
  } catch (err) {
    if (isWorkflowNotFound(err)) {
      throw new Error("Workflow is not running", { cause: err });
    }
    warn(`stopPipelineWorkflow(${cardId}) failed`, err);
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(String(err), { cause: err });
  }
}

export const stopSdlcWorkflow = stopPipelineWorkflow;
