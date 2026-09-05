import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { executeAskUser, executeSwitchMode } from "./toolsHitl.js";

describe("toolsHitl", () => {
  describe("executeAskUser", () => {
    it("rejects missing kind or empty prompt", () => {
      assert.equal(
        executeAskUser({ kind: "other", prompt: "x" }).success,
        false
      );
      assert.equal(
        executeAskUser({ kind: "mcq", prompt: "   " }).success,
        false
      );
    });

    it("requires at least two mcq options with id and label", () => {
      const empty = executeAskUser({
        kind: "mcq",
        prompt: "Pick",
        options: []
      });
      assert.equal(empty.success, false);
      assert.match(empty.output, /at least two options/);

      const one = executeAskUser({
        kind: "mcq",
        prompt: "Pick",
        options: [{ id: "a", label: "A" }]
      });
      assert.equal(one.success, false);

      const blank = executeAskUser({
        kind: "mcq",
        prompt: "Pick",
        options: [
          { id: " ", label: "A" },
          { id: "b", label: "B" }
        ]
      });
      assert.equal(blank.success, false);
    });

    it("returns mcq metadata for valid options", () => {
      const r = executeAskUser({
        kind: "mcq",
        prompt: "  Choose one  ",
        options: [
          { id: " a ", label: " Alpha " },
          { id: "b", label: "Beta" }
        ]
      });
      assert.equal(r.success, true);
      assert.match(r.output, /Waiting for the user/);
      assert.deepEqual(r.metadata, {
        needsUserInput: true,
        kind: "mcq",
        prompt: "Choose one",
        options: [
          { id: "a", label: "Alpha" },
          { id: "b", label: "Beta" }
        ]
      });
    });

    it("requires form fields and preserves secret/placeholder/value", () => {
      const missing = executeAskUser({
        kind: "form",
        prompt: " creds",
        fields: []
      });
      assert.equal(missing.success, false);
      assert.match(missing.output, /at least one field/);

      const r = executeAskUser({
        kind: "form",
        prompt: "Enter token",
        fields: [
          {
            id: " token ",
            label: " Token ",
            secret: true,
            placeholder: " sk-… ",
            value: "default"
          },
          { id: "skip", label: "  " }
        ]
      });
      assert.equal(r.success, true);
      assert.deepEqual(r.metadata, {
        needsUserInput: true,
        kind: "form",
        prompt: "Enter token",
        fields: [
          {
            id: "token",
            label: "Token",
            secret: true,
            placeholder: "sk-…",
            value: "default"
          }
        ]
      });
    });
  });

  describe("executeSwitchMode", () => {
    it("rejects invalid targets", () => {
      const r = executeSwitchMode({
        currentMode: "ask",
        input: { target: "nope" }
      });
      assert.equal(r.success, false);
      assert.match(r.output, /Invalid mode target/);
    });

    it("proposes switch when not in auto mode", () => {
      const r = executeSwitchMode({
        currentMode: "ask",
        input: { target: "plan" }
      });
      assert.equal(r.success, true);
      assert.deepEqual(r.metadata, {
        applied: false,
        target: "plan",
        needsConfirmation: true
      });
      assert.match(r.output, /wait for the user to confirm/i);
    });

    it("applies immediately in auto mode", () => {
      const r = executeSwitchMode({
        currentMode: "auto",
        input: { target: "agent" }
      });
      assert.equal(r.success, true);
      assert.deepEqual(r.metadata, {
        applied: true,
        target: "agent",
        mode: "agent"
      });
      assert.match(r.output, /Switched to agent/);
    });
  });
});
