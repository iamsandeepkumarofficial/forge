import { describe, expect, it } from "vitest";
import {
  applyPlanStreamEvent,
  mergePlanPreferringProgress
} from "./use-plan-stream";
import type { PlanCardModel } from "./plan-card.js";

const basePlan: PlanCardModel = {
  goal: "Ship login",
  status: "running",
  version: 1,
  tasks: [
    {
      id: "inspect",
      description: "Inspect auth",
      status: "pending",
      dependencies: []
    },
    {
      id: "implement",
      description: "Implement form",
      status: "pending",
      dependencies: ["inspect"]
    }
  ]
};

describe("applyPlanStreamEvent", () => {
  it("updates task status from nested task payload", () => {
    const next = applyPlanStreamEvent({
      prev: basePlan,
      eventType: "task_updated",
      payload: {
        task: { id: "inspect", status: "completed" }
      }
    });
    expect(next?.tasks.find((t) => t.id === "inspect")?.status).toBe(
      "completed"
    );
  });

  it("stores streamTurnId from task_updated and task_started", () => {
    const updated = applyPlanStreamEvent({
      prev: basePlan,
      eventType: "task_updated",
      payload: {
        task: {
          id: "inspect",
          status: "running",
          streamTurnId: "stream-1"
        }
      }
    });
    expect(updated?.tasks.find((t) => t.id === "inspect")?.streamTurnId).toBe(
      "stream-1"
    );
    const started = applyPlanStreamEvent({
      prev: basePlan,
      eventType: "task_started",
      payload: {
        taskId: "implement",
        streamTurnId: "stream-2"
      }
    });
    const task = started?.tasks.find((t) => t.id === "implement");
    expect(task?.status).toBe("running");
    expect(task?.streamTurnId).toBe("stream-2");
  });

  it("updates task status from flat contract payload", () => {
    const next = applyPlanStreamEvent({
      prev: basePlan,
      eventType: "task_updated",
      payload: {
        taskId: "inspect",
        status: "completed"
      }
    });
    expect(next?.tasks.find((t) => t.id === "inspect")?.status).toBe(
      "completed"
    );
  });

  it("accepts plan_published with nested or flat plan", () => {
    const nested = applyPlanStreamEvent({
      prev: null,
      eventType: "plan_published",
      payload: {
        plan: {
          goal: "G",
          status: "running",
          version: 1,
          tasks: [{ id: "t1", description: "A", status: "pending" }]
        }
      }
    });
    expect(nested?.goal).toBe("G");
    expect(nested?.tasks).toHaveLength(1);

    const flat = applyPlanStreamEvent({
      prev: null,
      eventType: "plan_published",
      payload: {
        goal: "Flat",
        status: "running",
        version: 1,
        tasks: [{ id: "t1", description: "A", status: "running" }]
      }
    });
    expect(flat?.goal).toBe("Flat");
    expect(flat?.tasks[0]?.status).toBe("running");
  });
});

describe("mergePlanPreferringProgress", () => {
  it("keeps completed status when a stale fetch returns pending", () => {
    const live: PlanCardModel = {
      ...basePlan,
      tasks: [
        { ...basePlan.tasks[0]!, status: "completed" },
        { ...basePlan.tasks[1]!, status: "running" }
      ]
    };
    const stale = basePlan;
    const merged = mergePlanPreferringProgress(live, stale);
    expect(merged?.tasks.find((t) => t.id === "inspect")?.status).toBe(
      "completed"
    );
    expect(merged?.tasks.find((t) => t.id === "implement")?.status).toBe(
      "running"
    );
  });
});
