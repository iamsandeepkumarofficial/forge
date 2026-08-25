import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { executeWebToolCall, executeCreateSubtask } from "./toolExecutors.js";
import { ChatFeatureValidationError } from "../projects/chatFeatureService.js";

describe("toolExecutors", () => {
  it("validates web_search query before execute", async () => {
    const out = await executeWebToolCall({
      sessionId: "s",
      toolName: "web_search",
      args: { query: "  " }
    });
    assert.equal(out.kind, "result");
    assert.equal(out.status, 400);
    assert.equal(
      (out.body as { metadata: { code: string } }).metadata.code,
      "provider"
    );
  });

  it("create_subtask 404s when session has no owner", async () => {
    const out = await executeCreateSubtask({
      sessionId: "missing",
      args: { title: "x" },
      chatFeatureRepo: { getBySessionId: async () => null } as never,
      chatFeatureService: {} as never
    });
    assert.equal(out.status, 404);
  });

  it("create_subtask maps validation errors to 400", async () => {
    const out = await executeCreateSubtask({
      sessionId: "s1",
      args: { title: "x" },
      chatFeatureRepo: {
        getBySessionId: async () => ({
          id: "c1",
          projectId: "p1",
          userId: "u1"
        })
      } as never,
      chatFeatureService: {
        create: async () => {
          throw new ChatFeatureValidationError("bad");
        }
      } as never
    });
    assert.equal(out.status, 400);
    assert.equal((out.body as { output: string }).output, "bad");
  });
});
