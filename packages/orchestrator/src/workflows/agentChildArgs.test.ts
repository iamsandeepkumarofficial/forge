import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyObjectSchema } from "@forge/core";
import { buildAgentChildArgs } from "./agentChildArgs.js";
import { buildTaskBrief } from "./taskBrief.js";

describe("agentChildArgs", () => {
  it("builds child args and records worktree when concurrency allows", async () => {
    const schema = emptyObjectSchema();
    const task = {
      id: "a",
      description: "Do",
      executor: "agent" as const,
      dependencies: [],
      status: "running" as const,
      idempotent: false,
      attemptCount: 1,
      waitReason: null,
      inputSchema: schema,
      outputSchema: schema
    };
    const args = await buildAgentChildArgs({
      ctx: {
        args: {
          sessionId: "s",
          turnId: "t",
          provider: "openai",
          mode: "agent"
        },
        goal: "Ship auth",
        sections: [{ title: "Problem", body: "No login" }],
        planId: "p",
        version: 1,
        maxConcurrency: 1,
        short: {
          ensureTaskWorktree: async () => ({ worktreePath: "/wt" }),
          createTaskStreamTurn: async () => ({
            turnId: "stream-a",
            workflowId: "agent-task-stream-s-p-a-1"
          })
        }
      } as never,
      task
    });
    assert.equal(args.taskId, "a");
    assert.equal(args.worktreePath, null);
    assert.equal(args.quiet, true);
    assert.equal(args.streamTurnId, "stream-a");
    assert.match(args.description, /Ship auth/);
    assert.match(args.description, /Problem: No login/);
    assert.match(args.description, /Task: Do/);
  });

  it("includes goal, sections, and rationale in child brief", () => {
    const schema = emptyObjectSchema();
    const brief = buildTaskBrief({
      voice: "child",
      goal: "Research topics",
      sections: [{ title: "Approach", body: "Fan out reads" }],
      taskId: "r1",
      description: "Research A",
      rationale: "Independent topic",
      input: { q: "a" },
      outputSchema: schema
    });
    assert.match(brief, /Research topics/);
    assert.match(brief, /Approach: Fan out reads/);
    assert.match(brief, /Independent topic/);
    assert.match(brief, /"q":"a"/);
  });
});
