import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAgentChildArgs } from "./agentChildArgs.js";

describe("agentChildArgs", () => {
  it("builds child args and records worktree when concurrency allows", async () => {
    const task = {
      id: "a",
      description: "Do",
      executor: "agent" as const,
      dependencies: [],
      status: "running" as const,
      idempotent: false,
      attemptCount: 1,
      waitReason: null
    };
    const args = await buildAgentChildArgs({
      ctx: {
        args: {
          sessionId: "s",
          turnId: "t",
          provider: "openai",
          mode: "agent"
        },
        planId: "p",
        version: 1,
        maxConcurrency: 1,
        short: {
          ensureTaskWorktree: async () => ({ worktreePath: "/wt" })
        }
      } as never,
      task
    });
    assert.equal(args.taskId, "a");
    assert.equal(args.worktreePath, null);
  });
});
