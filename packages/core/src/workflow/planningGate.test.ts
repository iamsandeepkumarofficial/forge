import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parsePlanningGateResult,
  planningGateShortcut,
  resolvePlanningGate
} from "./planningGate.js";

describe("planningGateShortcut", () => {
  it("routes empty and ask mode to direct", () => {
    assert.deepEqual(planningGateShortcut({ userText: "", mode: "agent" }), {
      needsPlanning: false,
      reason: "empty_message"
    });
    assert.deepEqual(
      planningGateShortcut({
        userText: "Implement OAuth for the API",
        mode: "ask"
      }),
      { needsPlanning: false, reason: "ask_mode" }
    );
  });

  it("routes plan mode to needsPlanning", () => {
    assert.deepEqual(
      planningGateShortcut({ userText: "Add auth", mode: "plan" }),
      { needsPlanning: true, reason: "plan_mode" }
    );
  });

  it("returns null for agent text that needs the LLM", () => {
    assert.equal(planningGateShortcut({ userText: "Hi", mode: "agent" }), null);
  });
});

describe("parsePlanningGateResult", () => {
  it("parses boolean needsPlanning", () => {
    assert.deepEqual(
      parsePlanningGateResult({ needsPlanning: false, reason: "greeting" }),
      { needsPlanning: false, reason: "greeting" }
    );
    assert.deepEqual(
      parsePlanningGateResult({ needsPlanning: true, reason: "multi_step" }),
      { needsPlanning: true, reason: "multi_step" }
    );
  });

  it("parses JSON string and fenced JSON", () => {
    assert.equal(
      parsePlanningGateResult(
        '{"needsPlanning":false,"reason":"single_question"}'
      ).needsPlanning,
      false
    );
    assert.equal(
      parsePlanningGateResult(
        '```json\n{"needsPlanning":true,"reason":"deps"}\n```'
      ).needsPlanning,
      true
    );
  });

  it("under-plans on invalid input", () => {
    assert.equal(parsePlanningGateResult("not json").needsPlanning, false);
    assert.equal(parsePlanningGateResult(null).needsPlanning, false);
    assert.equal(parsePlanningGateResult({}).needsPlanning, false);
  });
});

describe("resolvePlanningGate", () => {
  it("prefers shortcuts over llmRaw", () => {
    const r = resolvePlanningGate({
      userText: "x",
      mode: "plan",
      llmRaw: { needsPlanning: false, reason: "ignored" }
    });
    assert.equal(r.needsPlanning, true);
    assert.equal(r.reason, "plan_mode");
  });

  it("uses llmRaw when no shortcut", () => {
    const r = resolvePlanningGate({
      userText: "Hi",
      mode: "agent",
      llmRaw: { needsPlanning: false, reason: "greeting" }
    });
    assert.deepEqual(r, { needsPlanning: false, reason: "greeting" });
  });

  it("defaults to direct without llmRaw", () => {
    const r = resolvePlanningGate({ userText: "Hi", mode: "agent" });
    assert.equal(r.needsPlanning, false);
    assert.equal(r.reason, "default_direct");
  });
});
