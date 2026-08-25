import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  partsToModelMessages,
  sanitizeToolCallPairs,
  withFirstTurnRepoEval
} from "./chatMessages.js";
import type { ModelMessage } from "ai";

describe("chatMessages", () => {
  it("partsToModelMessages maps roles and sanitizes orphan tool calls", () => {
    const messages = partsToModelMessages([
      {
        id: "1",
        role: "user",
        parts: [{ type: "text", text: "hi" }]
      },
      {
        id: "2",
        role: "assistant",
        parts: [
          {
            type: "tool-invocation",
            toolCallId: "tc1",
            toolName: "read_file",
            args: { path: "a.ts" }
          }
        ]
      },
      {
        id: "3",
        role: "user",
        parts: [{ type: "text", text: "next" }]
      }
    ]);
    assert.equal(messages[0]?.role, "user");
    assert.equal(messages[1]?.role, "assistant");
    assert.equal(messages[2]?.role, "tool");
    const toolMsg = messages[2] as {
      content: Array<{ output: { value: string } }>;
    };
    assert.match(toolMsg.content[0]!.output.value, /tool call interrupted/);
    assert.equal(messages[3]?.role, "user");
  });

  it("partsToModelMessages maps tool results and thought signatures", () => {
    const messages = partsToModelMessages([
      {
        id: "1",
        role: "assistant",
        parts: [
          { type: "text", text: "calling" },
          {
            type: "tool-invocation",
            toolCallId: "tc1",
            toolName: "read_file",
            args: { path: "a.ts" },
            thoughtSignature: "sig"
          }
        ]
      },
      {
        id: "2",
        role: "tool",
        parts: [
          {
            type: "tool-result",
            toolCallId: "tc1",
            toolName: "read_file",
            output: "ok"
          }
        ]
      }
    ]);
    assert.equal(messages[0]?.role, "assistant");
    const assistant = messages[0] as {
      content: Array<Record<string, unknown>>;
    };
    assert.equal(assistant.content[0]?.type, "text");
    assert.equal(assistant.content[1]?.type, "tool-call");
    assert.deepEqual(
      (
        assistant.content[1] as {
          providerOptions?: { google: { thoughtSignature: string } };
        }
      ).providerOptions,
      { google: { thoughtSignature: "sig" } }
    );
    assert.equal(messages[1]?.role, "tool");
  });

  it("sanitizeToolCallPairs leaves paired calls untouched", () => {
    const input: ModelMessage[] = [
      { role: "user", content: "hi" },
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tc1",
            toolName: "read_file",
            input: {}
          }
        ]
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "tc1",
            toolName: "read_file",
            output: { type: "text", value: "ok" }
          }
        ]
      }
    ];
    const out = sanitizeToolCallPairs(input);
    assert.equal(out.length, 3);
    assert.equal(out[2]?.role, "tool");
  });

  it("withFirstTurnRepoEval prepends only before any assistant or tool turn", () => {
    const first = withFirstTurnRepoEval([
      { id: "1", role: "user", parts: [{ type: "text", text: "hi" }] }
    ]);
    assert.equal(first[0]?.id, "repo-readiness-eval");
    assert.match(JSON.stringify(first[0]?.parts), /preview_start/);
    assert.match(JSON.stringify(first[0]?.parts), /upsert_launch_app/);
    assert.doesNotMatch(JSON.stringify(first[0]?.parts), /ask the user/);
    assert.equal(first[1]?.id, "1");
    const later = withFirstTurnRepoEval([
      { id: "1", role: "user", parts: [{ type: "text", text: "hi" }] },
      { id: "2", role: "assistant", parts: [{ type: "text", text: "ok" }] }
    ]);
    assert.equal(later[0]?.id, "1");
  });
});
