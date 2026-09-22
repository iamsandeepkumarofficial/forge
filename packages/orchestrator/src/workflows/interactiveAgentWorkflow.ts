import {
  proxyActivities,
  isCancellation,
  workflowInfo,
  defineSignal,
  setHandler
} from "@temporalio/workflow";
import {
  MAX_AGENTS_PER_RUN,
  accrueWorkingMs,
  type QueuedFollowUp
} from "@forge/core";
import type * as activities from "../activities/index.js";
import {
  buildResult,
  failureMessage,
  isLocalChatProvider,
  assistantTextForFinalize,
  type InteractiveChatTurnResult
} from "./chatTurnHelpers.js";
import type { InteractiveAgentArgs } from "./chatTurnHelpers.js";
import { assistantPartsForStep, runToolRoundLoop } from "./reactLoop.js";
import { draftToTasks, isMutatingMode } from "./agentWorkflowModel.js";
import {
  formatPlanMarkdown,
  planTurnSummary,
  resultStatusForPlan
} from "./agentPlanClassify.js";
import {
  persistCtxPlan,
  persistCtxTasks,
  snapshotFromCtx
} from "./agentPlanPersist.js";
import {
  createPlanRunContext,
  runPlanExecutionLoop,
  type PlanRunContext
} from "./agentPlanLoop.js";

export type { InteractiveAgentArgs };

export const queueFollowUpSignal =
  defineSignal<[QueuedFollowUp]>("queueFollowUp");
export const forceSendSignal = defineSignal("forceSend");
export const userAnswerSignal =
  defineSignal<[{ text: string; taskId?: string }]>("userAnswer");
export const cancelRunSignal = defineSignal("cancelRun");

const short = proxyActivities<typeof activities>({
  startToCloseTimeout: "2 minutes",
  retry: { maximumAttempts: 5, initialInterval: "2s", backoffCoefficient: 2 }
});
const sandbox = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 minutes",
  heartbeatTimeout: "30 seconds",
  retry: { maximumAttempts: 3, initialInterval: "5s", backoffCoefficient: 2 }
});
const planner = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 minutes",
  heartbeatTimeout: "2 minutes",
  retry: { maximumAttempts: 2, initialInterval: "5s" }
});
const llmCloud = proxyActivities<typeof activities>({
  startToCloseTimeout: "15 minutes",
  heartbeatTimeout: "2 minutes",
  retry: { maximumAttempts: 1 }
});
const llmLocal = proxyActivities<typeof activities>({
  startToCloseTimeout: "45 minutes",
  heartbeatTimeout: "5 minutes",
  retry: { maximumAttempts: 1 }
});
const tools = proxyActivities<typeof activities>({
  startToCloseTimeout: "15 minutes",
  heartbeatTimeout: "5 minutes",
  retry: { maximumAttempts: 2, initialInterval: "5s" }
});

function llmActivities(provider: string) {
  return isLocalChatProvider(provider) ? llmLocal : llmCloud;
}

function bindPlanSignals(ctx: PlanRunContext): void {
  setHandler(queueFollowUpSignal, (q) => {
    ctx.queuedFollowUp = q;
  });
  setHandler(forceSendSignal, () => {
    ctx.cancelRequested = true;
  });
  setHandler(userAnswerSignal, (a) => {
    ctx.pendingAnswer = a;
  });
  setHandler(cancelRunSignal, () => {
    ctx.cancelRequested = true;
  });
}

async function runDirectReactTurn(opts: {
  args: InteractiveAgentArgs;
  toolNameSet: Set<string>;
}): Promise<InteractiveChatTurnResult> {
  const loop = await runToolRoundLoop({
    deps: {
      short,
      llm: llmActivities(opts.args.provider),
      tools
    },
    args: opts.args,
    currentMode: { value: opts.args.mode },
    toolNameSet: opts.toolNameSet
  });
  const finalText = assistantTextForFinalize({
    text: loop.finalText,
    reasoningText: loop.finalReasoningText,
    toolCallCount: loop.toolCallCount
  });
  await short.finalizeChatTurn({
    sessionId: opts.args.sessionId,
    turnId: opts.args.turnId,
    assistantParts: assistantPartsForStep({
      reasoningText: loop.finalReasoningText,
      text: finalText
    }),
    status: "completed"
  });
  return buildResult(opts.args, {
    status: "completed",
    rounds: loop.rounds,
    toolNames: [...opts.toolNameSet].sort(),
    toolCallCount: loop.toolCallCount,
    finalText
  });
}

async function persistPublishedPlan(ctx: PlanRunContext): Promise<void> {
  const persisted = await short.persistPlan({
    id: ctx.args.turnId,
    sessionId: ctx.args.sessionId,
    turnId: ctx.args.turnId,
    workflowId: ctx.workflowId,
    goal: ctx.goal,
    status: "planned",
    version: ctx.version,
    replanCount: ctx.replanCount,
    snapshot: snapshotFromCtx({ ctx, status: "planned" })
  });
  ctx.planId = String(
    (persisted.plan as { id?: string }).id ?? ctx.args.turnId
  );
  await persistCtxTasks(ctx);
  await short.publishPlanSnapshot({
    turnId: ctx.args.turnId,
    snapshot: snapshotFromCtx({ ctx, status: "planned" })
  });
  await short.appendChatMessage({
    sessionId: ctx.args.sessionId,
    role: "assistant",
    parts: [
      {
        type: "text",
        text: formatPlanMarkdown({ goal: ctx.goal, tasks: ctx.tasks })
      }
    ],
    turnId: ctx.args.turnId
  });
}

async function completePlanOnly(
  ctx: PlanRunContext,
  toolNameSet: Set<string>
): Promise<InteractiveChatTurnResult> {
  await persistCtxPlan({ ctx, status: "planned" });
  await short.finalizeChatTurn({
    sessionId: ctx.args.sessionId,
    turnId: ctx.args.turnId,
    assistantParts: [
      {
        type: "text",
        text: "Plan published. Switch to Agent mode to execute."
      }
    ],
    status: "completed"
  });
  return buildResult(ctx.args, {
    status: "completed",
    rounds: 1,
    toolNames: [...toolNameSet],
    toolCallCount: 0,
    finalText: "Plan published"
  });
}

async function markPlanRunning(ctx: PlanRunContext): Promise<void> {
  ctx.planStatus = "running";
  await persistCtxPlan({ ctx, status: "running" });
  await short.publishPlanStatus({
    turnId: ctx.args.turnId,
    status: "running"
  });
  ctx.lastTick = Date.now();
}

async function finalizePlanTurn(
  ctx: PlanRunContext,
  toolNameSet: Set<string>
): Promise<InteractiveChatTurnResult> {
  ctx.workingMs = accrueWorkingMs({
    previousWorkingMs: ctx.workingMs,
    elapsedMs: Date.now() - ctx.lastTick,
    workInFlight: false
  });
  const snapshot = await persistCtxPlan({ ctx, status: ctx.planStatus });
  await short.publishPlanStatus({
    turnId: ctx.args.turnId,
    status: ctx.planStatus
  });
  await short.publishPlanSnapshot({
    turnId: ctx.args.turnId,
    snapshot
  });
  return finishPlanTurn(ctx, toolNameSet);
}

async function finishPlanTurn(
  ctx: PlanRunContext,
  toolNameSet: Set<string>
): Promise<InteractiveChatTurnResult> {
  const summary = planTurnSummary({
    status: ctx.planStatus,
    taskCount: ctx.tasks.length
  });
  await short.finalizeChatTurn({
    sessionId: ctx.args.sessionId,
    turnId: ctx.args.turnId,
    assistantParts: [{ type: "text", text: summary }],
    status: ctx.planStatus === "failed" ? "failed" : "completed",
    error: ctx.planStatus === "failed" ? "Plan failed" : undefined
  });
  if (ctx.planStatus === "cancelled") {
    await short.finishChatTurn({
      turnId: ctx.args.turnId,
      status: "cancelled"
    });
  }
  return buildResult(ctx.args, {
    status: resultStatusForPlan(ctx.planStatus),
    rounds: ctx.rounds,
    toolNames: [...toolNameSet].sort(),
    toolCallCount: ctx.toolCallCount,
    finalText: ctx.finalText || summary
  });
}

async function handleAgentFailure(opts: {
  args: InteractiveAgentArgs;
  err: unknown;
  toolNameSet: Set<string>;
  rounds: number;
  toolCallCount: number;
  finalText: string;
}): Promise<InteractiveChatTurnResult> {
  if (isCancellation(opts.err)) {
    await short.finishChatTurn({
      turnId: opts.args.turnId,
      status: "cancelled"
    });
    return buildResult(opts.args, {
      status: "cancelled",
      rounds: opts.rounds,
      toolNames: [...opts.toolNameSet].sort(),
      toolCallCount: opts.toolCallCount,
      finalText: opts.finalText
    });
  }
  const message = failureMessage(opts.err);
  try {
    await short.finalizeChatTurn({
      sessionId: opts.args.sessionId,
      turnId: opts.args.turnId,
      assistantParts: [{ type: "text", text: `Error: ${message}` }],
      status: "failed",
      error: message
    });
  } catch {
    await short.finishChatTurn({
      turnId: opts.args.turnId,
      status: "failed",
      error: message
    });
  }
  throw opts.err;
}

async function runPlannedTurn(opts: {
  args: InteractiveAgentArgs;
  toolNameSet: Set<string>;
}): Promise<InteractiveChatTurnResult> {
  opts.toolNameSet.add("planner");
  const draft = await planner.createPlan({
    sessionId: opts.args.sessionId,
    turnId: opts.args.turnId,
    goal: opts.args.userText,
    provider: opts.args.provider,
    model: opts.args.model,
    mode: opts.args.mode
  });
  const ctx = createPlanRunContext({
    args: opts.args,
    workflowId: workflowInfo().workflowId,
    planId: opts.args.turnId,
    goal: draft.goal,
    tasks: draftToTasks(draft),
    short,
    planner,
    maxConcurrency: Math.min(
      Math.max(1, opts.args.maxConcurrency ?? 4),
      MAX_AGENTS_PER_RUN
    )
  });
  bindPlanSignals(ctx);
  await persistPublishedPlan(ctx);
  if (!isMutatingMode(opts.args.mode)) {
    return completePlanOnly(ctx, opts.toolNameSet);
  }
  await markPlanRunning(ctx);
  await runPlanExecutionLoop(ctx);
  return finalizePlanTurn(ctx, opts.toolNameSet);
}

async function runInteractiveAgent(opts: {
  args: InteractiveAgentArgs;
  toolNameSet: Set<string>;
}): Promise<InteractiveChatTurnResult> {
  await sandbox.ensureChatSandbox(opts.args.sessionId);
  await short.appendChatMessage({
    sessionId: opts.args.sessionId,
    role: "user",
    parts: [{ type: "text", text: opts.args.userText }],
    turnId: opts.args.turnId
  });
  const gate = await planner.runPlanningGate({
    sessionId: opts.args.sessionId,
    turnId: opts.args.turnId,
    userText: opts.args.userText,
    provider: opts.args.provider,
    model: opts.args.model,
    mode: opts.args.mode
  });
  if (!gate.needsPlanning) {
    return runDirectReactTurn(opts);
  }
  return runPlannedTurn(opts);
}

export async function interactiveAgentWorkflow(
  args: InteractiveAgentArgs
): Promise<InteractiveChatTurnResult> {
  const toolNameSet = new Set<string>();
  try {
    return await runInteractiveAgent({ args, toolNameSet });
  } catch (err) {
    return handleAgentFailure({
      args,
      err,
      toolNameSet,
      rounds: 0,
      toolCallCount: 0,
      finalText: ""
    });
  }
}
