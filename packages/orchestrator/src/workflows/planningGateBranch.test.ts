import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePlanningGate } from "@forge/core";

describe("interactiveAgentWorkflow planning gate branch", () => {
  it("Hi in agent mode with LLM saying direct skips planning", () => {
    const gate = resolvePlanningGate({
      userText: "Hi",
      mode: "agent",
      llmRaw: { needsPlanning: false, reason: "greeting" }
    });
    assert.equal(gate.needsPlanning, false);
  });

  it("multi-step with LLM saying plan enters planner path", () => {
    const gate = resolvePlanningGate({
      userText: "Add auth then write tests",
      mode: "agent",
      llmRaw: { needsPlanning: true, reason: "multi_step" }
    });
    assert.equal(gate.needsPlanning, true);
  });

  it("plan mode forces planning even without LLM", () => {
    const gate = resolvePlanningGate({
      userText: "Hi",
      mode: "plan"
    });
    assert.equal(gate.needsPlanning, true);
  });
});
