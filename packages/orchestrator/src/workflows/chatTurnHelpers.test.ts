import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildResult,
  failureMessage,
  isLocalChatProvider,
  parseAppliedMode,
  previewText
} from "./chatTurnHelpers.js";

describe("chatTurnHelpers", () => {
  it("isLocalChatProvider detects openai-compatible and custom", () => {
    assert.equal(isLocalChatProvider("openai-compatible"), true);
    assert.equal(isLocalChatProvider(" CUSTOM "), true);
    assert.equal(isLocalChatProvider("openai"), false);
    assert.equal(isLocalChatProvider("anthropic"), false);
  });

  it("previewText truncates long text with ellipsis", () => {
    assert.equal(previewText("  short  "), "short");
    const long = "x".repeat(600);
    const preview = previewText(long);
    assert.equal(preview.endsWith("…"), true);
    assert.equal(preview.length, 501);
  });

  it("failureMessage prefers specific nested causes", () => {
    const err = new Error("Activity task failed", {
      cause: new Error("model timeout")
    });
    assert.equal(failureMessage(err), "model timeout");
    assert.equal(failureMessage(new Error("only")), "only");
    assert.equal(failureMessage({ message: "obj" }), "obj");
  });

  it("buildResult shapes InteractiveChatTurnResult", () => {
    const result = buildResult(
      {
        sessionId: "s1",
        turnId: "t1",
        userText: "hi",
        mode: "plan",
        provider: "openai",
        model: "gpt-4o-mini"
      },
      {
        status: "completed",
        rounds: 2,
        toolNames: ["read_file"],
        toolCallCount: 1,
        finalText: "  hello  ",
        error: undefined
      }
    );
    assert.deepEqual(result, {
      sessionId: "s1",
      turnId: "t1",
      status: "completed",
      mode: "plan",
      provider: "openai",
      model: "gpt-4o-mini",
      rounds: 2,
      toolCallCount: 1,
      toolNames: ["read_file"],
      finalTextPreview: "hello"
    });
  });

  it("parseAppliedMode accepts known modes", () => {
    assert.equal(parseAppliedMode({ mode: "ask" }), "ask");
    assert.equal(parseAppliedMode({ mode: "build" }), "agent");
    assert.equal(parseAppliedMode({ mode: "nope" }), null);
  });
});
