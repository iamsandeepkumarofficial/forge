import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interactiveAgentWorkflow } from "./interactiveAgentWorkflow.js";

describe("interactiveAgentWorkflow", () => {
  it("exports the parent workflow function", () => {
    assert.equal(typeof interactiveAgentWorkflow, "function");
  });
});
