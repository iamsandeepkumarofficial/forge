import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { emptyObjectSchema } from "@forge/core";
import { buildTaskBrief } from "../taskBrief.js";
import { AgentExecutor, runInlineAgentTask } from "./agent.js";
import type { PlanRunContext } from "../agentPlanTypes.js";
import type { TaskState } from "../agentWorkflowModel.js";

const schema = emptyObjectSchema();

function taskState(partial: Partial<TaskState> & { id: string }): TaskState {
  return {
    description: partial.description ?? partial.id,
    executor: "agent",
    dependencies: [],
    status: "running",
    idempotent: true,
    attemptCount: 1,
    waitReason: null,
    inputSchema: schema,
    outputSchema: {
      schemaVersion: 1,
      type: "object",
      additionalProperties: false,
      properties: { findings: { type: "string" } },
      required: ["findings"]
    },
    ...partial
  };
}

describe("AgentExecutor", () => {
  it("supports both inline and child paths", async () => {
    const agentPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "agent.ts"
    );
    const src = await readFile(agentPath, "utf8");
    assert.equal(src.includes("startChild"), true);
    assert.equal(src.includes("executeAgentTaskWorkflow"), true);
    assert.equal(src.includes("runInlineAgentTask"), true);
    assert.equal(src.includes("effectiveIsolation"), true);
  });

  it("routes to runInline when isolation is inline", async () => {
    const ctx = {
      forceChildIsolation: false,
      react: null
    } as unknown as PlanRunContext;
    const ex = new AgentExecutor({ ctx });

    const result = await ex.execute({
      task: taskState({ id: "code", isolation: "inline" }),
      context: {
        workflowId: "wf",
        sessionId: "s",
        turnId: "t",
        planId: "p",
        taskId: "code",
        input: {}
      }
    });
    assert.equal(result.kind, "failed");
    assert.match(
      (result as { error: string }).error,
      /missing react activity proxies/
    );
  });

  it("builds a plan-aware inline brief", () => {
    const task = taskState({
      id: "inspect",
      description: "Inspect auth",
      rationale: "Need a map first"
    });
    const brief = buildTaskBrief({
      voice: "inline",
      goal: "Ship auth",
      sections: [
        { title: "Problem", body: "No session boundary" },
        { title: "Risks", body: "Breaking sessions" }
      ],
      taskId: task.id,
      description: task.description,
      rationale: task.rationale,
      input: { note: "x" },
      outputSchema: task.outputSchema
    });
    assert.match(brief, /Ship auth/);
    assert.match(brief, /Problem: No session boundary/);
    assert.match(brief, /Risks: Breaking sessions/);
    assert.match(brief, /Need a map first/);
    assert.match(brief, /"note":"x"/);
    assert.match(brief, /outputSchema/);
  });

  it("runInlineAgentTask seeds the brief in memory and returns structured output", async () => {
    const appended: string[] = [];
    let seenBrief = false;
    const ctx = {
      goal: "Research X",
      sections: [
        { title: "Problem", body: "Need findings" },
        { title: "Approach", body: "Search then summarize" }
      ],
      args: {
        sessionId: "s",
        turnId: "parent-turn",
        userText: "go",
        mode: "agent",
        provider: "openai",
        model: "gpt"
      },
      rounds: 0,
      toolCallCount: 0,
      finalText: "",
      react: {
        short: {
          appendChatMessage: async (input: {
            parts: Array<{ type: string; text?: string }>;
            turnId?: string;
          }) => {
            const text = input.parts
              .map((p) => (p.type === "text" ? (p.text ?? "") : ""))
              .join("");
            appended.push(text);
            assert.equal(input.turnId, "parent-turn");
            return {
              id: "m1",
              role: "user",
              parts: input.parts
            };
          },
          loadChatMessages: async () => [
            {
              id: "m0",
              role: "user",
              parts: [{ type: "text", text: "prior chat" }]
            }
          ],
          rejectChatToolCall: async () => undefined
        },
        llm: {
          runLlmStep: async (input: {
            messages: Array<{ parts: Array<{ type?: string; text?: string }> }>;
          }) => {
            const text = input.messages
              .flatMap((message) => message.parts)
              .map((part) => part.text ?? "")
              .join("\n");
            seenBrief =
              text.includes("Research topic") && text.includes("Need findings");
            return {
              text: JSON.stringify({ findings: "A found B" }),
              reasoningText: "",
              finishReason: "stop",
              toolCalls: []
            };
          }
        },
        tools: {
          executeChatTool: async () => {
            throw new Error("tools should not run in this test");
          }
        }
      }
    } as unknown as PlanRunContext;

    const result = await runInlineAgentTask({
      ctx,
      task: taskState({ id: "research", description: "Research topic" }),
      context: {
        workflowId: "wf",
        sessionId: "s",
        turnId: "parent-turn",
        planId: "p",
        taskId: "research",
        input: {}
      }
    });
    assert.equal(result.kind, "completed");
    if (result.kind === "completed") {
      assert.deepEqual(result.output, {
        kind: "value",
        value: { findings: "A found B" }
      });
    }
    assert.equal(appended.length, 0);
    assert.equal(seenBrief, true);
    assert.equal(ctx.rounds, 0);
    assert.equal(ctx.toolCallCount, 0);
    if (result.kind === "completed") {
      assert.equal((result.metrics?.rounds ?? 0) > 0, true);
    }
  });
});
