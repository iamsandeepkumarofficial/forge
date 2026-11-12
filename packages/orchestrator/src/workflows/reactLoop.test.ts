import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assistantPartsForStep,
  runToolRoundLoop,
  trivialStructuredOutputGaps
} from "./reactLoop.js";

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

  it("quiet mode skips parent chat appends and uses seed messages", async () => {
    let appendCount = 0;
    let loadCount = 0;
    let sawQuietOnLlm = false;
    let sawQuietOnTool = false;
    let llmMessages: unknown[] = [];
    const result = await runToolRoundLoop({
      deps: {
        short: {
          loadChatMessages: async () => {
            loadCount += 1;
            return [];
          },
          appendChatMessage: async () => {
            appendCount += 1;
          },
          rejectChatToolCall: async () => undefined
        },
        llm: {
          runLlmStep: async (input: {
            quiet?: boolean;
            messages: unknown[];
          }) => {
            sawQuietOnLlm = input.quiet === true;
            llmMessages = input.messages;
            if ((input.messages as unknown[]).length === 1) {
              return {
                text: "",
                reasoningText: "",
                finishReason: "tool-calls",
                toolCalls: [
                  {
                    toolCallId: "tc1",
                    toolName: "search",
                    args: { q: "x" }
                  }
                ]
              };
            }
            return {
              text: "done",
              reasoningText: "",
              finishReason: "stop",
              toolCalls: [],
              structuredOutput: { summary: "ok" }
            };
          }
        },
        tools: {
          executeChatTool: async (input: { quiet?: boolean }) => {
            sawQuietOnTool = input.quiet === true;
            return { output: "found", success: true };
          }
        }
      } as never,
      args: {
        sessionId: "s",
        turnId: "t",
        userText: "hi",
        mode: "agent",
        provider: "openai",
        quiet: true
      },
      currentMode: { value: "agent" },
      toolNameSet: new Set(),
      outputSchema: {
        type: "object",
        properties: { summary: { type: "string" } },
        required: ["summary"],
        additionalProperties: false
      },
      seedMessages: [
        {
          id: "seed",
          role: "user",
          parts: [{ type: "text", text: "contract" }]
        }
      ]
    });
    assert.equal(result.finalText, "done");

    assert.equal(result.rounds, 2);
    assert.equal(appendCount, 0);
    assert.equal(loadCount, 0);
    assert.equal(sawQuietOnLlm, true);
    assert.equal(sawQuietOnTool, true);
    assert.equal((llmMessages as unknown[]).length >= 1, true);
    assert.deepEqual(result.structuredOutput, { summary: "ok" });
  });

  it("flags empty required string/array fields as trivial", () => {
    const gaps = trivialStructuredOutputGaps(
      {
        type: "object",
        properties: {
          findings: { type: "string" },
          repoList: { type: "array", items: { type: "string" } }
        },
        required: ["findings", "repoList"]
      },
      { findings: "", repoList: [] }
    );
    assert.deepEqual(gaps, [
      "findings is an empty string",
      "repoList is an empty array"
    ]);
  });

  it("accepts schema-valid JSON on the first response", async () => {
    let calls = 0;
    const prompts: string[] = [];
    const result = await runToolRoundLoop({
      deps: {
        short: {
          loadChatMessages: async () => [],
          appendChatMessage: async () => undefined,
          rejectChatToolCall: async () => undefined
        },
        llm: {
          runLlmStep: async (input: {
            messages: Array<{ parts?: Array<{ text?: string }> }>;
          }) => {
            calls += 1;
            for (const message of input.messages) {
              for (const part of message.parts ?? []) {
                if (part.text) prompts.push(part.text);
              }
            }
            return {
              text: JSON.stringify({
                findings: "jamwithai builds AI agents",
                repoList: ["jamwithai/forge"]
              }),
              reasoningText: "",
              finishReason: "stop",
              toolCalls: []
            };
          }
        },
        tools: {
          executeChatTool: async () => {
            throw new Error("tools should not run");
          }
        }
      } as never,
      args: {
        sessionId: "s",
        turnId: "t",
        userText: "research",
        mode: "agent",
        provider: "openai",
        quiet: true
      },
      currentMode: { value: "agent" },
      toolNameSet: new Set(),
      outputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          findings: { type: "string" },
          repoList: { type: "array", items: { type: "string" } }
        },
        required: ["findings", "repoList"]
      },
      seedMessages: [
        { id: "seed", role: "user", parts: [{ type: "text", text: "task" }] }
      ]
    });
    assert.equal(calls, 1);
    assert.equal(result.rounds, 1);
    assert.equal(result.toolCallCount, 0);
    assert.equal(
      prompts.some((text) => text.includes("without calling tools")),
      false
    );
    assert.deepEqual(result.structuredOutput, {
      findings: "jamwithai builds AI agents",
      repoList: ["jamwithai/forge"]
    });
  });

  it("repairs empty structured findings without demanding tools", async () => {
    const calls: Array<{ hasSchema: boolean; prompt: string }> = [];
    const result = await runToolRoundLoop({
      deps: {
        short: {
          loadChatMessages: async () => [],
          appendChatMessage: async () => undefined,
          rejectChatToolCall: async () => undefined
        },
        llm: {
          runLlmStep: async (input: {
            outputSchema?: unknown;
            messages: Array<{ parts?: Array<{ text?: string }> }>;
          }) => {
            const prompt = input.messages
              .flatMap((message) => message.parts ?? [])
              .map((part) => part.text ?? "")
              .join("\n");
            calls.push({
              hasSchema: input.outputSchema !== undefined,
              prompt
            });
            if (calls.length === 1) {
              return {
                text: JSON.stringify({ findings: "", repoList: [] }),
                reasoningText: "",
                finishReason: "stop",
                toolCalls: []
              };
            }
            return {
              text: "",
              reasoningText: "",
              finishReason: "stop",
              toolCalls: [],
              structuredOutput: {
                findings: "jamwithai builds AI agents",
                repoList: ["jamwithai/forge"]
              }
            };
          }
        },
        tools: {
          executeChatTool: async () => ({ output: "ok", success: true })
        }
      } as never,
      args: {
        sessionId: "s",
        turnId: "t",
        userText: "research",
        mode: "agent",
        provider: "openai",
        quiet: true
      },
      currentMode: { value: "agent" },
      toolNameSet: new Set(),
      outputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          findings: { type: "string" },
          repoList: { type: "array", items: { type: "string" } }
        },
        required: ["findings", "repoList"]
      },
      seedMessages: [
        { id: "seed", role: "user", parts: [{ type: "text", text: "task" }] }
      ]
    });
    assert.equal(calls[0]?.hasSchema, false);
    assert.equal(calls[1]?.hasSchema, true);
    assert.equal(calls[1]?.prompt.includes("without calling tools"), false);
    assert.match(calls[1]?.prompt ?? "", /outputSchema validation/);
    assert.equal(result.toolCallCount, 0);
    assert.equal(result.rounds, 2);
    assert.deepEqual(result.structuredOutput, {
      findings: "jamwithai builds AI agents",
      repoList: ["jamwithai/forge"]
    });
  });

  it("quiet + streamTurnId routes LLM/tool turnId to the child stream", async () => {
    let llmTurnId = "";
    let toolTurnId = "";
    let sawStreamId: string | undefined;
    await runToolRoundLoop({
      deps: {
        short: {
          loadChatMessages: async () => [],
          appendChatMessage: async () => undefined,
          rejectChatToolCall: async () => undefined
        },
        llm: {
          runLlmStep: async (input: {
            turnId: string;
            streamTurnId?: string;
            quiet?: boolean;
          }) => {
            llmTurnId = input.turnId;
            sawStreamId = input.streamTurnId;
            return {
              text: "done",
              reasoningText: "",
              finishReason: "stop",
              toolCalls: []
            };
          }
        },
        tools: {
          executeChatTool: async (input: { turnId: string }) => {
            toolTurnId = input.turnId;
            return { output: "", success: true };
          }
        }
      } as never,
      args: {
        sessionId: "s",
        turnId: "parent",
        userText: "hi",
        mode: "agent",
        provider: "openai",
        quiet: true,
        streamTurnId: "child-stream"
      },
      currentMode: { value: "agent" },
      toolNameSet: new Set(),
      seedMessages: [
        { id: "seed", role: "user", parts: [{ type: "text", text: "c" }] }
      ]
    });
    assert.equal(llmTurnId, "child-stream");
    assert.equal(sawStreamId, "child-stream");
    assert.equal(toolTurnId, "");
  });
});
