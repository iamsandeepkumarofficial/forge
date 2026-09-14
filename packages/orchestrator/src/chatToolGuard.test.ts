import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { denyChatToolExecute } from "./chatToolGuard.js";

describe("chatToolGuard", () => {
  it("denies write_file in ask mode", () => {
    const denied = denyChatToolExecute({
      agentMode: "ask",
      toolName: "write_file",
      args: { path: "a.ts", content: "x" }
    });
    assert.equal(denied?.success, false);
    assert.match(denied?.output ?? "", /not available in ask mode/);
  });

  it("denies npm run dev via run_terminal", () => {
    const denied = denyChatToolExecute({
      agentMode: "agent",
      toolName: "run_terminal",
      args: { command: "npm run dev", workingDirectory: "portfolio" }
    });
    assert.equal(denied?.success, false);
    assert.match(denied?.output ?? "", /preview_start/);
    const background = denyChatToolExecute({
      agentMode: "agent",
      toolName: "run_terminal",
      args: { command: "npm run dev", background: true }
    });
    assert.equal(background?.success, false);
  });

  it("denies rm and mv via run_terminal", () => {
    const denied = denyChatToolExecute({
      agentMode: "agent",
      toolName: "run_terminal",
      args: { command: "rm src/a.ts" }
    });
    assert.equal(denied?.success, false);
    assert.match(denied?.output ?? "", /delete_files/);
    assert.equal(
      denyChatToolExecute({
        agentMode: "agent",
        toolName: "run_terminal",
        args: { command: "npm rm lodash" }
      }),
      null
    );
  });

  it("allows one-shot shell and write in agent", () => {
    assert.equal(
      denyChatToolExecute({
        agentMode: "agent",
        toolName: "run_terminal",
        args: { command: "pnpm test" }
      }),
      null
    );
    assert.equal(
      denyChatToolExecute({
        agentMode: "agent",
        toolName: "write_file",
        args: { path: "a.ts", content: "x" }
      }),
      null
    );
  });
});
