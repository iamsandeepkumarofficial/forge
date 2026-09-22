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

describe("planHandlers", () => {
  let handleGetCurrentPlan: typeof import("./planHandlers.js").handleGetCurrentPlan;
  let planJsonWithLiveTasks: typeof import("./planHandlers.js").planJsonWithLiveTasks;
  let currentPlan: unknown = null;

  before(async () => {
    mock.module("../../catalog/workflowPlanRepository.js", {
      exports: {
        WorkflowPlanRepository: class {
          async getCurrentBySessionId() {
            return currentPlan;
          }
          async listTasks() {
            return [];
          }
        }
      }
    });
    ({ handleGetCurrentPlan, planJsonWithLiveTasks } =
      await import("./planHandlers.js"));
  });

  it("returns 404 when the session belongs to another user", async () => {
    const { res, state } = mockRes();
    await handleGetCurrentPlan({
      req: {
        params: { sessionId: "s1" },
        forgeUser: { id: "u1" }
      } as never,
      res,
      features: {
        async getBySessionId() {
          return { userId: "other" };
        }
      } as never
    });
    assert.equal(state.statusCode, 404);
  });

  it("returns a null plan when none exists for the session", async () => {
    currentPlan = null;
    const { res, state } = mockRes();
    await handleGetCurrentPlan({
      req: {
        params: { sessionId: "s1" },
        forgeUser: { id: "u1" }
      } as never,
      res,
      features: {
        async getBySessionId() {
          return null;
        }
      } as never
    });
    assert.deepEqual(state.body, { plan: null, tasks: [] });
  });

  it("overlays live tasks onto a snapshot", async () => {
    const json = await planJsonWithLiveTasks(
      {
        async listTasks() {
          return [
            {
              id: "t1",
              description: "inspect",
              executor: "agent",
              dependencies: [],
              status: "pending",
              idempotent: true,
              attemptCount: 0,
              waitReason: null,
              error: null
            }
          ];
        }
      } as never,
      {
        id: "p1",
        goal: "Ship auth",
        status: "running",
        version: 1,
        snapshot: { goal: "Ship auth", status: "planned", version: 1 }
      }
    );
    assert.equal(json.status, "running");
    assert.equal((json.tasks as { id: string }[])[0]?.id, "t1");
  });
});
