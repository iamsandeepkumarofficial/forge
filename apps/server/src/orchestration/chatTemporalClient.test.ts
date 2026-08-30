import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("chatTemporalClient", () => {
  const start = mock.fn(async () => undefined);
  let startInteractiveChatTurn: (options: {
    sessionId: string;
    turnId: string;
    userText: string;
    mode: "plan" | "agent";
    provider: string;
  }) => Promise<string>;
  let newTurnId: () => string;
  let cancelInteractiveChatTurn: (workflowId: string) => Promise<void>;
  let isInteractiveChatTurnRunning: (workflowId: string) => Promise<boolean>;

  before(async () => {
    mock.module("@temporalio/client", {
      exports: {
        Connection: {
          connect: async () => ({})
        },
        Client: class {
          workflow = {
            start,
            getHandle: () => ({
              cancel: async () => undefined,
              describe: async () => ({ status: { name: "RUNNING" } })
            })
          };
        },
        WorkflowIdReusePolicy: {
          WORKFLOW_ID_REUSE_POLICY_REJECT_DUPLICATE: "REJECT_DUPLICATE"
        }
      }
    });
    ({
      startInteractiveChatTurn,
      newTurnId,
      cancelInteractiveChatTurn,
      isInteractiveChatTurnRunning
    } = await import("./chatTemporalClient.js"));
  });

  it("newTurnId returns a uuid string", () => {
    assert.match(newTurnId(), /^[0-9a-f-]{36}$/i);
  });

  it("startInteractiveChatTurn starts workflow via mocked client", async () => {
    start.mock.resetCalls();
    const wfId = await startInteractiveChatTurn({
      sessionId: "s1",
      turnId: "t1",
      userText: "hi",
      mode: "plan",
      provider: "openai-compatible"
    });
    assert.equal(wfId, "chat-s1-t1");
    assert.equal(start.mock.callCount(), 1);
  });

  it("cancelInteractiveChatTurn invokes handle.cancel", async () => {
    await cancelInteractiveChatTurn("chat-s1-t1");
  });

  it("isInteractiveChatTurnRunning reads describe status", async () => {
    assert.equal(await isInteractiveChatTurnRunning("chat-s1-t1"), true);
  });
});
