import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

function mockRes() {
  const state: { statusCode: number; body: unknown } = {
    statusCode: 200,
    body: null
  };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(body: unknown) {
      state.body = body;
      return res;
    }
  };
  return { res: res as never, state };
}

describe("workflow.handlers", () => {
  let handleCreateOrUpdatePlan: typeof import("./workflow.handlers.js").handleCreateOrUpdatePlan;
  let handleCountRunningAgentTasks: typeof import("./workflow.handlers.js").handleCountRunningAgentTasks;
  let created: Record<string, unknown> = { id: "p1", goal: "g" };
  let runningCount = 0;

  before(async () => {
    mock.module("../../catalog/workflowPlanRepository.js", {
      exports: {
        WorkflowPlanRepository: class {
          async getByTurnId() {
            return null;
          }
          async create() {
            return created;
          }
          async update() {
            return created;
          }
          async getById() {
            return created;
          }
          async listTasks() {
            return [];
          }
          async upsertTasks() {
            return [];
          }
          async updateTask() {
            return null;
          }
          async countRunningAgentTasks() {
            return runningCount;
          }
        }
      }
    });
    mock.module("../../catalog/chatFeatureRepository.js", {
      exports: {
        ChatFeatureRepository: class {
          async getBySessionId() {
            return null;
          }
        }
      }
    });
    mock.module("../../projects/localWorktree.js", {
      exports: {
        worktreeWorkDir: () => "/tmp/session",
        ensureTaskWorktree: async () => ({ worktreePath: "/tmp/task" }),
        mergeTaskWorktree: async () => ({ ok: true })
      }
    });
    ({ handleCreateOrUpdatePlan, handleCountRunningAgentTasks } =
      await import("./workflow.handlers.js"));
  });

  it("rejects a plan upsert without required fields", async () => {
    const { res, state } = mockRes();
    await handleCreateOrUpdatePlan({
      req: { body: { sessionId: "s1" } } as never,
      res
    });
    assert.equal(state.statusCode, 400);
  });

  it("creates a plan when turnId is new", async () => {
    created = { id: "p1", goal: "Ship auth", sessionId: "s1" };
    const { res, state } = mockRes();
    await handleCreateOrUpdatePlan({
      req: {
        body: {
          sessionId: "s1",
          turnId: "t1",
          workflowId: "agent-s1-t1",
          goal: "Ship auth"
        }
      } as never,
      res
    });
    assert.equal(state.statusCode, 200);
    assert.equal((state.body as { plan: { id: string } }).plan.id, "p1");
  });

  it("returns the running agent task count", async () => {
    runningCount = 3;
    const { res, state } = mockRes();
    await handleCountRunningAgentTasks({ res });
    assert.deepEqual(state.body, { count: 3 });
  });
});
