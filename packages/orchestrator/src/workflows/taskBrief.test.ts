import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTaskBrief } from "./taskBrief.js";

describe("buildTaskBrief", () => {
  it("includes the task and its input", () => {
    const brief = buildTaskBrief({
      voice: "task",
      taskId: "a",
      description: "Do it",
      input: { n: 1 }
    });
    assert.match(brief, /Task: Do it/);
    assert.match(brief, /"n":1/);
  });
});
