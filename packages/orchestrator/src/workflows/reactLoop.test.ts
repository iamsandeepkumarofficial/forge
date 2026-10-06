import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assistantPartsForStep, runToolRoundLoop } from "./reactLoop.js";

describe("reactLoop", () => {
  it("builds assistant parts with optional reasoning", () => {
    const parts = assistantPartsForStep({
      reasoningText: "think",
      text: "hello"
    }) as Array<{ type: string; text?: string }>;
    assert.equal(parts[0]?.type, "reasoning");
    assert.equal(parts[1]?.type, "text");
  });

  it("stops when the model returns no tool calls", async () => {
    const result = await runToolRoundLoop({
      deps: {
        short: {
          loadChatMessages: async () => [],
          appendChatMessage: async () => undefined,
          rejectChatToolCall: async () => undefined
        },
        llm: {
          runLlmStep: async () => ({
            text: "done",
            reasoningText: "",
            finishReason: "stop",
            toolCalls: []
          })
        },
        tools: {
          executeChatTool: async () => ({
            output: "",
            success: true
          })
        }
      } as never,
      args: {
        sessionId: "s",
        turnId: "t",
        userText: "hi",
        mode: "ask",
        provider: "openai"
      },
      currentMode: { value: "ask" },
      toolNameSet: new Set()
    });
    assert.equal(result.finalText, "done");
    assert.equal(result.rounds, 1);
    assert.equal(result.pauseForUserInput, false);
  });
});
