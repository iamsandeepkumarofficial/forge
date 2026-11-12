import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { draftToTasks } from "./agentWorkflowModel.js";
import { createPlanRunContext } from "./agentPlanLoop.js";
import {
  applyExecutionResult,
  launchReadyTasks,
  resumeWaitingTask
} from "./agentPlanLaunch.js";
import {
  AgentExecutor,
  ExecutorRegistry,
  HumanExecutor,
  ToolExecutor,
  toolNeedsApproval,
  type TaskExecutor
} from "./executors/index.js";
import type { TaskState } from "./agentWorkflowModel.js";
import { withSchemas } from "./testTaskDraft.js";
import { emptyObjectSchema, type TaskExecutionContext } from "@forge/core";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

function stubShort() {
  const patches: Array<{ taskId: string; status?: string }> = [];
  return {
    patches,
    short: {
      persistTask: async (input: {
        taskId: string;
        patch: { status?: string };
      }) => {
        patches.push({ taskId: input.taskId, status: input.patch.status });
        return { task: null };
      },
      publishTaskUpdated: async () => undefined,
      publishPlanStatus: async () => undefined,
      appendChatMessage: async () => undefined,
      ensureTaskWorktree: async () => ({ worktreePath: "/tmp/wt" }),
      mergeTaskWorktree: async () => ({ ok: true }),
      persistPlan: async () => ({ plan: {} }),
      publishPlanSnapshot: async () => undefined,
      publishMergeConflict: async () => undefined,
      appendPlanChunk: async () => undefined,
      createTaskStreamTurn: async () => ({
        turnId: "stream-stub",
        workflowId: "agent-task-stream-stub"
      }),
      prepareTaskInput: async (input: { staticInput?: unknown }) => ({
        ok: true as const,
        input: input.staticInput ?? {}
      }),
      spillTaskOutput: async (input: { value: unknown }) => ({
        kind: "value" as const,
        value: input.value
      }),
      loadTaskArtifact: async () => ({
        ok: false as const,
        error: "not found"
      })
    }
  };
}

function ctxBase(taskId: string): TaskExecutionContext {
  return {
    workflowId: "w",
    sessionId: "s",
    turnId: "t",
    planId: "p",
    taskId,
    input: {}
  };
}

describe("executor kinds", () => {
  it("toolNeedsApproval covers install/deploy/destructive tools", () => {
    assert.equal(toolNeedsApproval("install_project_infra"), true);
    assert.equal(toolNeedsApproval("deploy_preview"), true);
    assert.equal(toolNeedsApproval("read_file"), false);
  });

  it("human execute waits then resume completes", async () => {
    const human = new HumanExecutor();
    const task = draftToTasks(
      withSchemas({
        goal: "g",
        tasks: [{ id: "h", description: "Approve?", executor: "human" }]
      })
    )[0]!;
    const waiting = await human.execute({ task, context: ctxBase("h") });
    assert.equal(waiting.kind, "waiting");
    const done = await human.resume({
      task,
      payload: { decision: "approve", text: "yes" },
      context: ctxBase("h")
    });
    assert.equal(done.kind, "completed");
  });

  it("human reject fails and does not complete", async () => {
    const human = new HumanExecutor();
    const task = draftToTasks(
      withSchemas({
        goal: "g",
        tasks: [{ id: "h", description: "Approve?", executor: "human" }]
      })
    )[0]!;
    const rejected = await human.resume({
      task,
      payload: { decision: "reject" },
      context: ctxBase("h")
    });
    assert.equal(rejected.kind, "failed");
  });

  it("tool without toolName fails visibly", async () => {
    const tool = new ToolExecutor(async () => ({
      success: true,
      output: "ok"
    }));
    const task = draftToTasks(
      withSchemas({
        goal: "g",
        tasks: [{ id: "t1", description: "Run", executor: "tool" }]
      })
    )[0]!;
    const result = await tool.execute({ task, context: ctxBase("t1") });
    assert.equal(result.kind, "failed");
    assert.match(result.error, /toolName/);
  });

  it("tool with toolName calls executeDirectTool not agent", async () => {
    const calls: string[] = [];
    const tool = new ToolExecutor(async (input) => {
      calls.push(input.toolName);
      return { success: true, output: "ok" };
    });
    const task: TaskState = {
      ...draftToTasks(
        withSchemas({
          goal: "g",
          tasks: [
            {
              id: "t1",
              description: "List",
              executor: "tool",
              input: { toolName: "list_files" }
            }
          ]
        })
      )[0]!,
      input: { toolName: "list_files" }
    };
    const result = await tool.execute({ task, context: ctxBase("t1") });
    assert.equal(result.kind, "completed");
    assert.deepEqual(calls, ["list_files"]);
  });

  it("approval-required tool waits and does not execute", async () => {
    let ran = false;
    const tool = new ToolExecutor(async () => {
      ran = true;
      return { success: true, output: "ok" };
    });
    const task: TaskState = {
      ...draftToTasks(
        withSchemas({
          goal: "g",
          tasks: [
            {
              id: "t1",
              description: "Install",
              executor: "tool",
              input: { toolName: "install_project_infra" }
            }
          ]
        })
      )[0]!,
      input: { toolName: "install_project_infra" }
    };
    const result = await tool.execute({ task, context: ctxBase("t1") });
    assert.equal(result.kind, "waiting");
    assert.equal(ran, false);
  });

  it("unknown executor fails visibly via registry launch", async () => {
    const { short, patches } = stubShort();
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
      goal: "g",
      tasks: [
        {
          id: "x",
          description: "Mystery",
          executor: "http" as never,
          dependencies: [],
          status: "pending",
          idempotent: false,
          attemptCount: 0,
          waitReason: null,
          inputSchema: emptyObjectSchema(),
          outputSchema: emptyObjectSchema()
        }
      ],
      short: short as never,
      planner: {} as never,
      maxConcurrency: 1,
      registry: new ExecutorRegistry()
    });
    await launchReadyTasks({ ctx, toStart: ["x"] });
    assert.equal(ctx.tasks[0]?.status, "failed");
    assert.match(ctx.tasks[0]?.error ?? "", /unknown executor/);
    assert.ok(patches.some((p) => p.status === "failed"));
  });

  it("fake executor works without engine launch changes", async () => {
    class FakeExecutor implements TaskExecutor {
      async execute(): Promise<{
        kind: "completed";
        output: { kind: "value"; value: Record<string, never> };
      }> {
        return { kind: "completed", output: { kind: "value", value: {} } };
      }
    }
    const { short } = stubShort();
    const registry = new ExecutorRegistry().register(
      "agent",
      new FakeExecutor()
    );
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
      goal: "g",
      tasks: draftToTasks(
        withSchemas({
          goal: "g",
          tasks: [{ id: "a", description: "Fake", executor: "agent" }]
        })
      ),
      short: short as never,
      planner: {} as never,
      maxConcurrency: 1,
      registry
    });
    await launchReadyTasks({ ctx, toStart: ["a"] });
    assert.equal(ctx.inFlight.size, 1);
    const finished = await ctx.inFlight.get("a")!.resultPromise;
    assert.equal(finished.result.kind, "completed");
    assert.deepEqual((finished.result as { output?: unknown }).output, {
      kind: "value",
      value: {}
    });
  });

  it("human completion unblocks a dependent via resume", async () => {
    const { short } = stubShort();
    const registry = new ExecutorRegistry()
      .register("human", new HumanExecutor())
      .register(
        "tool",
        new ToolExecutor(async () => ({ success: true, output: "published" }))
      );
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
      goal: "g",
      tasks: draftToTasks(
        withSchemas({
          goal: "g",
          tasks: [
            { id: "approval", description: "OK?", executor: "human" },
            {
              id: "publish",
              description: "Publish",
              executor: "tool",
              dependencies: ["approval"],
              input: { toolName: "list_files" }
            }
          ]
        })
      ),
      short: short as never,
      planner: {} as never,
      maxConcurrency: 1,
      registry
    });
    ctx.tasks[1]!.input = { toolName: "list_files" };
    await launchReadyTasks({ ctx, toStart: ["approval"] });
    assert.equal(ctx.tasks[0]?.status, "waiting");
    await resumeWaitingTask({
      ctx,
      task: ctx.tasks[0]!,
      payload: { decision: "approve", text: "yes" }
    });
    assert.equal(ctx.tasks[0]?.status, "completed");
  });

  it("root tool envelope skips closed inputSchema and still runs", async () => {
    const calls: string[] = [];
    const { short } = stubShort();
    const registry = new ExecutorRegistry().register(
      "tool",
      new ToolExecutor(async (input) => {
        calls.push(input.toolName);
        return { success: true, output: "{}" };
      })
    );
    const tasks = draftToTasks(
      withSchemas({
        goal: "g",
        tasks: [
          {
            id: "list",
            description: "List files",
            executor: "tool",
            input: { toolName: "list_files", args: { path: "." } }
          }
        ]
      })
    );
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
      goal: "g",
      tasks,
      short: short as never,
      planner: {} as never,
      maxConcurrency: 1,
      registry
    });
    await launchReadyTasks({ ctx, toStart: ["list"] });
    const finished = await ctx.inFlight.get("list")!.resultPromise;
    assert.equal(finished.result.kind, "completed");
    assert.deepEqual(calls, ["list_files"]);
    assert.equal(
      (ctx.tasks[0]?.input as { toolName?: string }).toolName,
      "list_files"
    );
    assert.notEqual(ctx.tasks[0]?.status, "failed");
  });

  it("reuses a running child stream across wait and opens a new one after failure", async () => {
    const { short } = stubShort();
    let created = 0;
    short.createTaskStreamTurn = async () => {
      created += 1;
      return {
        turnId: `stream-${created}`,
        workflowId: `agent-task-stream-${created}`
      };
    };
    class PauseThenFail implements TaskExecutor {
      calls = 0;
      async execute() {
        this.calls += 1;
        if (this.calls === 1) {
          return {
            kind: "waiting" as const,
            waitReason: { kind: "ask_user" as const, payload: { taskId: "a" } }
          };
        }
        return { kind: "failed" as const, error: "boom" };
      }
    }
    const executor = new PauseThenFail();
    const tasks = draftToTasks(
      withSchemas({
        goal: "g",
        tasks: [
          {
            id: "a",
            description: "Research",
            executor: "agent",
            isolation: "child"
          }
        ]
      })
    );
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
      goal: "g",
      tasks,
      short: short as never,
      planner: {} as never,
      maxConcurrency: 1,
      registry: new ExecutorRegistry().register("agent", executor)
    });

    await launchReadyTasks({ ctx, toStart: ["a"] });
    let finished = await ctx.inFlight.get("a")!.resultPromise;
    await applyExecutionResult({
      ctx,
      taskId: "a",
      result: finished.result,
      worktreePath: null
    });
    assert.equal(ctx.tasks[0]?.status, "waiting");
    assert.equal(ctx.tasks[0]?.streamTurnId, "stream-1");
    assert.equal(created, 1);

    await resumeWaitingTask({
      ctx,
      task: ctx.tasks[0]!,
      payload: { decision: "approve", text: "go on" }
    });
    assert.equal(ctx.tasks[0]?.status, "pending");
    ctx.inFlight.delete("a");
    await launchReadyTasks({ ctx, toStart: ["a"] });
    assert.equal(created, 1);
    assert.equal(ctx.tasks[0]?.streamTurnId, "stream-1");

    finished = await ctx.inFlight.get("a")!.resultPromise;
    await applyExecutionResult({
      ctx,
      taskId: "a",
      result: finished.result,
      worktreePath: null
    });
    assert.equal(ctx.tasks[0]?.status, "failed");
    assert.equal(ctx.tasks[0]?.streamTurnId, null);

    ctx.tasks[0]!.status = "pending";
    ctx.inFlight.delete("a");
    await launchReadyTasks({ ctx, toStart: ["a"] });
    assert.equal(created, 2);
    assert.equal(ctx.tasks[0]?.streamTurnId, "stream-2");
  });

  it("AgentExecutor class does not import ToolExecutor", async () => {
    const agentPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "executors",
      "agent.ts"
    );
    const src = await readFile(agentPath, "utf8");
    assert.equal(src.includes("ToolExecutor"), false);
    assert.equal(src.includes("executeDirectTool"), false);
    assert.equal(src.includes("startChild"), true);
    assert.equal(src.includes("effectiveIsolation"), true);
    assert.equal(typeof AgentExecutor, "function");
  });
});
