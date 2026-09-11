import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { executeAskUser, executeSwitchMode } from "./hitl.js";

describe("hitl", () => {
  it("rejects missing kind or empty prompt", () => {
    assert.equal(executeAskUser({ kind: "mcq", prompt: "   " }).success, false);
    assert.equal(
      executeAskUser({
        kind: "other" as "mcq",
        prompt: "x"
      }).success,
      false
    );
  });

  it("requires at least two mcq options", () => {
    const empty = executeAskUser({
      kind: "mcq",
      prompt: "Pick",
      options: []
    });
    assert.equal(empty.success, false);
    assert.match(empty.output, /at least two options/);
  });

  it("returns needsUserInput for mcq and form", () => {
    const mcq = executeAskUser({
      kind: "mcq",
      prompt: "Provision?",
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" }
      ]
    });
    assert.equal(mcq.metadata?.needsUserInput, true);
    assert.equal(mcq.metadata?.kind, "mcq");
    const form = executeAskUser({
      kind: "form",
      prompt: "Secrets",
      fields: [
        {
          id: "k",
          label: "Key",
          secret: true,
          value: "v",
          group: "Secrets",
          type: "secret"
        },
        {
          id: "ok",
          label: "Enable",
          type: "boolean",
          value: "true",
          group: "Infrastructure"
        }
      ]
    });
    assert.equal(form.metadata?.kind, "form");
    const fields = form.metadata?.fields as Array<Record<string, unknown>>;
    assert.equal(fields[0]?.group, "Secrets");
    assert.equal(fields[0]?.type, "secret");
    assert.equal(fields[1]?.type, "boolean");
    assert.equal(fields[1]?.group, "Infrastructure");
  });

  it("executeSwitchMode proposes outside auto and applies in auto", () => {
    const ask = executeSwitchMode({
      currentMode: "agent",
      input: { target: "plan" }
    });
    assert.equal(ask.metadata?.applied, false);
    const auto = executeSwitchMode({
      currentMode: "auto",
      input: { target: "plan" }
    });
    assert.equal(auto.metadata?.applied, true);
  });

  it("rejects invalid switch targets", () => {
    const r = executeSwitchMode({
      currentMode: "ask",
      input: { target: "nope" }
    });
    assert.equal(r.success, false);
  });
});
