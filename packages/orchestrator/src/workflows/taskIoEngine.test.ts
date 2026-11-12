import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { draftToTasks } from "./agentWorkflowModel.js";
import { createPlanRunContext } from "./agentPlanLoop.js";
import { launchReadyTasks, resumeWaitingTask } from "./agentPlanLaunch.js";
import { ExecutorRegistry, HumanExecutor } from "./executors/index.js";
import { withSchemas } from "./testTaskDraft.js";

describe("task I/O engine path", () => {
  it("rejects adversarial human payload that fails outputSchema", async () => {
    const patches: Array<{ taskId: string; status?: string; error?: string }> =
      [];
    const short = {
      persistTask: async (input: {
        taskId: string;
        patch: { status?: string; error?: string | null };
      }) => {
        patches.push({
          taskId: input.taskId,
          status: input.patch.status,
          ...(input.patch.error ? { error: input.patch.error } : {})
        });
        return { task: null };
      },
      publishTaskUpdated: async () => undefined,
      prepareTaskInput: async () => ({ ok: true as const, input: {} }),
      spillTaskOutput: async (input: { value: unknown }) => ({
        kind: "value" as const,
        value: input.value
      })
    };
    const schema = {
      schemaVersion: 1 as const,
      type: "object" as const,
      additionalProperties: false,
      properties: {
        approved: { type: "boolean" as const }
      },
      required: ["approved"]
    };
    const ctx = createPlanRunContext({
      args: {
        sessionId: "s",
        turnId: "t",
        userText: "hi",
        mode: "agent",
        provider: "openai"
      },
      workflowId: "wf",
      planId: "p1",
      goal: "Approve deploy",
      tasks: draftToTasks(
        withSchemas({
          goal: "Approve deploy",
          tasks: [
            {
              id: "gate",
              description: "Approve?",
              executor: "human",
              outputSchema: schema
            }
          ]
        })
      ),
      short: short as never,
      planner: {} as never,
      maxConcurrency: 1,
      registry: new ExecutorRegistry().register("human", new HumanExecutor())
    });
    await launchReadyTasks({ ctx, toStart: ["gate"] });
    assert.equal(ctx.tasks[0]?.status, "waiting");
    await resumeWaitingTask({
      ctx,
      task: ctx.tasks[0]!,
      payload: { decision: "approve", payload: { approved: "banana" } }
    });
    assert.equal(ctx.tasks[0]?.status, "failed");
    assert.match(ctx.tasks[0]?.error ?? "", /outputSchema validation failed/);
  });

  it("accepts schema-valid human payload", async () => {
    const short = {
      persistTask: async () => ({ task: null }),
      publishTaskUpdated: async () => undefined,
      prepareTaskInput: async () => ({ ok: true as const, input: {} }),
      spillTaskOutput: async (input: { value: unknown }) => ({
        kind: "value" as const,
        value: input.value
      }),
      appendChatMessage: async () => undefined,
      appendPlanChunk: async () => undefined
    };
    const schema = {
      schemaVersion: 1 as const,
      type: "object" as const,
      additionalProperties: false,
      properties: {
        approved: { type: "boolean" as const }
      },
      required: ["approved"]
    };
    const ctx = createPlanRunContext({
      args: {
        sessionId: "s",
        turnId: "t",
        userText: "hi",
        mode: "agent",
        provider: "openai"
      },
      workflowId: "wf",
      planId: "p1",
      goal: "Approve deploy",
      tasks: draftToTasks(
        withSchemas({
          goal: "Approve deploy",
          tasks: [
            {
              id: "gate",
              description: "Approve?",
              executor: "human",
              outputSchema: schema
            }
          ]
        })
      ),
      short: short as never,
      planner: {} as never,
      maxConcurrency: 1,
      registry: new ExecutorRegistry().register("human", new HumanExecutor())
    });
    await launchReadyTasks({ ctx, toStart: ["gate"] });
    await resumeWaitingTask({
      ctx,
      task: ctx.tasks[0]!,
      payload: { decision: "approve", payload: { approved: true } }
    });
    assert.equal(ctx.tasks[0]?.status, "completed");
    assert.deepEqual(ctx.tasks[0]?.output, {
      kind: "value",
      value: { approved: true }
    });
  });
});
