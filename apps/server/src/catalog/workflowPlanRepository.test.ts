import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

function thenable(value: unknown) {
  return {
    then(
      onFulfilled?: (v: unknown) => unknown,
      onRejected?: (e: unknown) => unknown
    ) {
      return Promise.resolve(value).then(onFulfilled, onRejected);
    }
  };
}

function chain(finalValue: unknown) {
  const api: Record<string, unknown> = {};
  for (const m of [
    "select",
    "from",
    "where",
    "orderBy",
    "limit",
    "insert",
    "values",
    "returning",
    "update",
    "set",
    "onConflictDoUpdate"
  ]) {
    api[m] = () => api;
  }
  api.returning = async () => finalValue;
  Object.assign(api, thenable(finalValue));
  return api;
}

describe("WorkflowPlanRepository", () => {
  let WorkflowPlanRepository: typeof import("./workflowPlanRepository.js").WorkflowPlanRepository;
  const created = {
    id: "p1",
    sessionId: "s1",
    turnId: "t1",
    workflowId: "wf1",
    goal: "Ship auth",
    status: "planned",
    version: 1
  };

  before(async () => {
    mock.module("@forge/db", {
      exports: {
        getDb: () => ({
          insert: () => chain([created]),
          select: () => chain([created]),
          update: () => chain([created])
        }),
        workflowPlans: {
          id: "id",
          sessionId: "sessionId",
          turnId: "turnId",
          updatedAt: "updatedAt"
        },
        workflowTasks: {
          planId: "planId",
          id: "id",
          version: "version",
          status: "status",
          executor: "executor"
        }
      }
    });
    ({ WorkflowPlanRepository } = await import("./workflowPlanRepository.js"));
  });

  it("creates a plan row", async () => {
    const repo = new WorkflowPlanRepository();
    const plan = await repo.create({
      sessionId: "s1",
      turnId: "t1",
      workflowId: "wf1",
      goal: "Ship auth"
    });
    assert.equal(plan.id, "p1");
    assert.equal(plan.goal, "Ship auth");
  });

  it("returns zero running agent tasks when the count query is empty", async () => {
    const repo = new WorkflowPlanRepository();
    const count = await repo.countRunningAgentTasks();
    assert.equal(count, 0);
  });
});
