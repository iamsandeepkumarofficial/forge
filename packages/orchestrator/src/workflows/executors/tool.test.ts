import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ToolExecutor } from "./tool.js";
import { draftToTasks } from "../agentWorkflowModel.js";
import { withSchemas } from "../testTaskDraft.js";

describe("ToolExecutor", () => {
  it("fails without toolName and runs named tools", async () => {
    const calls: string[] = [];
    const tool = new ToolExecutor(async (input) => {
      calls.push(input.toolName);
      return { success: true, output: "ok" };
    });
    const bare = draftToTasks(
      withSchemas({
        goal: "g",
        tasks: [{ id: "t", description: "x", executor: "tool" }]
      })
    )[0]!;
    const context = {
      workflowId: "w",
      sessionId: "s",
      turnId: "t",
      planId: "p",
      taskId: "t",
      input: {}
    };
    assert.equal((await tool.execute({ task: bare, context })).kind, "failed");
    const named = { ...bare, input: { toolName: "list_files" } };
    assert.equal(
      (await tool.execute({ task: named, context })).kind,
      "completed"
    );
    assert.deepEqual(calls, ["list_files"]);
  });
});
