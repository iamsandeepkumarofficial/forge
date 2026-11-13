import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPlanRunContext, runPlanExecutionLoop } from "./agentPlanLoop.js";
import {
  applyExecutionResult,
  transcriptNoteFromOutput
} from "./agentPlanLaunch.js";
import { draftToTasks } from "./agentWorkflowModel.js";
import { withSchemas } from "./testTaskDraft.js";
import { ExecutorRegistry, HumanExecutor } from "./executors/index.js";

describe("agentPlanLoop", () => {
  it("exports the plan loop helpers", () => {
    assert.equal(typeof runPlanExecutionLoop, "function");
    assert.equal(typeof applyExecutionResult, "function");
    assert.equal(typeof createPlanRunContext, "function");
  });

  it("applies a completed execution onto task state", async () => {
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
      goal: "Ship",
      tasks: draftToTasks(
        withSchemas({
          goal: "Ship",
          tasks: [
            {
              id: "a",
              description: "Do it",
              executor: "agent",
              dependencies: []
            }
          ]
        })
      ),
      short: {
        mergeTaskWorktree: async () => ({ ok: true }),
        persistTask: async () => ({ task: null }),
        publishTaskUpdated: async () => undefined,
        spillTaskOutput: async (input: { value: unknown }) => ({
          kind: "value" as const,
          value: input.value
        }),
        prepareTaskInput: async () => ({ ok: true as const, input: {} })
      } as never,
      planner: {} as never,
      maxConcurrency: 2,
      registry: new ExecutorRegistry().register("human", new HumanExecutor())
    });
    await applyExecutionResult({
      ctx,
      taskId: "a",
      result: {
        kind: "completed",
        output: { kind: "value", value: {} },
        metrics: { rounds: 1, toolCallCount: 0 }
      },
      worktreePath: null
    });
    assert.equal(ctx.tasks[0]?.status, "completed");
    assert.equal(ctx.finalText, "");
  });

  it("captures summary from structured agent output", async () => {
    const schema = {
      schemaVersion: 1 as const,
      type: "object" as const,
      additionalProperties: false,
      properties: { summary: { type: "string" as const } },
      required: ["summary"]
    };
    const chatParts: unknown[] = [];
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
      goal: "Ship",
      tasks: draftToTasks(
        withSchemas({
          goal: "Ship",
          tasks: [
            {
              id: "a",
              description: "Do it",
              executor: "agent",
              dependencies: [],
              outputSchema: schema
            }
          ]
        })
      ),
      short: {
        mergeTaskWorktree: async () => ({ ok: true }),
        persistTask: async () => ({ task: null }),
        publishTaskUpdated: async () => undefined,
        appendPlanChunk: async () => undefined,
        appendChatMessage: async (input: { parts: unknown[] }) => {
          chatParts.push(...input.parts);
          return { id: "m1", role: "assistant", parts: input.parts };
        },
        spillTaskOutput: async (input: { value: unknown }) => ({
          kind: "value" as const,
          value: input.value
        }),
        prepareTaskInput: async () => ({ ok: true as const, input: {} })
      } as never,
      planner: {} as never,
      maxConcurrency: 2,
      registry: new ExecutorRegistry().register("human", new HumanExecutor())
    });
    await applyExecutionResult({
      ctx,
      taskId: "a",
      result: {
        kind: "completed",
        output: { kind: "value", value: { summary: "done" } },
        metrics: { rounds: 1, toolCallCount: 0 }
      },
      worktreePath: null
    });
    assert.equal(ctx.tasks[0]?.status, "completed");
    assert.equal(ctx.finalText, "done");
    assert.deepEqual(chatParts, [{ type: "text", text: "### Do it\n\ndone" }]);
  });

  it("posts findings from research-style output into the parent transcript", async () => {
    const schema = {
      schemaVersion: 1 as const,
      type: "object" as const,
      additionalProperties: false,
      properties: { findings: { type: "string" as const } },
      required: ["findings"]
    };
    const chatParts: unknown[] = [];
    const chunks: Array<{
      eventType: string;
      payload: Record<string, unknown>;
    }> = [];
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
      goal: "Research",
      tasks: draftToTasks(
        withSchemas({
          goal: "Research",
          tasks: [
            {
              id: "research_a",
              description: "Research Acme",
              executor: "agent",
              dependencies: [],
              outputSchema: schema
            }
          ]
        })
      ),
      short: {
        mergeTaskWorktree: async () => ({ ok: true }),
        persistTask: async () => ({ task: null }),
        publishTaskUpdated: async () => undefined,
        appendPlanChunk: async (input: {
          eventType: string;
          payload: Record<string, unknown>;
        }) => {
          chunks.push(input);
        },
        appendChatMessage: async (input: { parts: unknown[] }) => {
          chatParts.push(...input.parts);
          return { id: "m1", role: "assistant", parts: input.parts };
        },
        spillTaskOutput: async (input: { value: unknown }) => ({
          kind: "value" as const,
          value: input.value
        }),
        prepareTaskInput: async () => ({ ok: true as const, input: {} })
      } as never,
      planner: {} as never,
      maxConcurrency: 2,
      registry: new ExecutorRegistry().register("human", new HumanExecutor())
    });
    await applyExecutionResult({
      ctx,
      taskId: "research_a",
      result: {
        kind: "completed",
        output: {
          kind: "value",
          value: { findings: "Acme grew 20% YoY." }
        },
        metrics: { rounds: 1, toolCallCount: 0 }
      },
      worktreePath: null
    });
    assert.deepEqual(chatParts, [
      {
        type: "text",
        text: "### Research Acme\n\nAcme grew 20% YoY."
      }
    ]);
    assert.equal(chunks[0]?.eventType, "task_result_message");
  });

  it("keeps a chat note when the output spills to an artifact", () => {
    const note = transcriptNoteFromOutput({
      taskId: "research_a",
      description: "Research Acme",
      output: {
        kind: "artifact",
        artifactId: "a1",
        metadata: { bytes: 70000, contentType: "application/json" }
      },
      materialized: { findings: "Acme grew 20% YoY." }
    });
    assert.match(note ?? "", /Acme grew 20% YoY/);
  });
});
