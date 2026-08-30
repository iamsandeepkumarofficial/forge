import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isToolAllowedForMode,
  parseAgentMode,
  resolveChatAgentMode,
  toolDeniedMessage
} from "./agentMode.js";

describe("agentMode", () => {
  it("parseAgentMode maps legacy build to agent", () => {
    assert.equal(parseAgentMode("build"), "agent");
    assert.equal(parseAgentMode("plan"), "plan");
    assert.equal(parseAgentMode("auto"), "auto");
    assert.equal(parseAgentMode("nope"), null);
  });

  it("resolveChatAgentMode fails closed to ask", () => {
    assert.equal(resolveChatAgentMode(undefined), "ask");
    assert.equal(resolveChatAgentMode("debug"), "debug");
  });

  it("Ask forbids write and preview start", () => {
    assert.equal(
      isToolAllowedForMode({ agentMode: "ask", toolName: "read_file" }),
      true
    );
    assert.equal(
      isToolAllowedForMode({ agentMode: "ask", toolName: "write_file" }),
      false
    );
    assert.equal(
      isToolAllowedForMode({ agentMode: "ask", toolName: "preview_start" }),
      false
    );
    assert.equal(
      isToolAllowedForMode({ agentMode: "ask", toolName: "upsert_launch_app" }),
      false
    );
    assert.equal(
      isToolAllowedForMode({ agentMode: "ask", toolName: "ask_user" }),
      true
    );
  });

  it("Plan allows preview and subtask but not shell", () => {
    assert.equal(
      isToolAllowedForMode({ agentMode: "plan", toolName: "preview_start" }),
      true
    );
    assert.equal(
      isToolAllowedForMode({ agentMode: "plan", toolName: "create_subtask" }),
      true
    );
    assert.equal(
      isToolAllowedForMode({ agentMode: "plan", toolName: "run_terminal" }),
      false
    );
  });

  it("Agent allows write and not create_subtask", () => {
    assert.equal(
      isToolAllowedForMode({ agentMode: "agent", toolName: "write_file" }),
      true
    );
    assert.equal(
      isToolAllowedForMode({ agentMode: "agent", toolName: "create_subtask" }),
      false
    );
  });

  it("Multitask adds create_subtask; Auto uses agent tools", () => {
    assert.equal(
      isToolAllowedForMode({
        agentMode: "multitask",
        toolName: "create_subtask"
      }),
      true
    );
    assert.equal(
      isToolAllowedForMode({ agentMode: "auto", toolName: "write_file" }),
      true
    );
    assert.equal(
      isToolAllowedForMode({ agentMode: "auto", toolName: "create_subtask" }),
      false
    );
  });

  it("toolDeniedMessage names mode and tool", () => {
    assert.equal(
      toolDeniedMessage({ agentMode: "ask", toolName: "write_file" }),
      "write_file is not available in ask mode"
    );
  });
});
