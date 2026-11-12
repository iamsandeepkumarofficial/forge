import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { effectiveIsolation, userRequestsSubAgents } from "./taskIsolation.js";

describe("taskIsolation", () => {
  it("detects user requests for sub-agents", () => {
    assert.equal(userRequestsSubAgents("research with sub-agents"), true);
    assert.equal(userRequestsSubAgents("use subagent for research"), true);
    assert.equal(userRequestsSubAgents("run parallel agents please"), true);
    assert.equal(userRequestsSubAgents("fan-out the research"), true);
    assert.equal(userRequestsSubAgents("implement auth"), false);
  });

  it("honors explicit isolation over forceChild", () => {
    assert.equal(
      effectiveIsolation({
        task: { executor: "agent", isolation: "inline" },
        forceChildIsolation: true
      }),
      "inline"
    );
    assert.equal(
      effectiveIsolation({
        task: { executor: "agent", isolation: "child" },
        forceChildIsolation: false
      }),
      "child"
    );
  });

  it("defaults unspecified agent to child when forceChildIsolation", () => {
    assert.equal(
      effectiveIsolation({
        task: { executor: "agent" },
        forceChildIsolation: true
      }),
      "child"
    );
    assert.equal(
      effectiveIsolation({
        task: { executor: "agent" },
        forceChildIsolation: false
      }),
      "inline"
    );
  });

  it("treats non-agent executors as inline", () => {
    assert.equal(
      effectiveIsolation({
        task: { executor: "tool", isolation: "child" },
        forceChildIsolation: true
      }),
      "inline"
    );
  });
});
