import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { executeAgentTaskWorkflow } from "./executeAgentTaskWorkflow.js";

describe("executeAgentTaskWorkflow", () => {
  it("exports the child workflow function", () => {
    assert.equal(typeof executeAgentTaskWorkflow, "function");
  });
});
