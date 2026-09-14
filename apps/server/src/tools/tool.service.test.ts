import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { ToolService } from "./tool.service.js";
import { ChatFeatureValidationError } from "../projects/chatFeatureService.js";

describe("ToolService", () => {
  it("returns error for unknown tools", async () => {
    const svc = new ToolService({
      previewTools: {} as never,
      chatFeatureRepo: {} as never,
      chatFeatureService: {} as never
    });
    const out = await svc.execute({
      sessionId: "s",
      toolName: "nope",
      args: {}
    });
    assert.equal(out.kind, "error");
    assert.equal(out.status, 400);
  });

  it("validates web_search query before execute", async () => {
    const svc = new ToolService({
      previewTools: {} as never,
      chatFeatureRepo: {} as never,
      chatFeatureService: {} as never
    });
    const out = await svc.execute({
      sessionId: "s",
      toolName: "web_search",
      args: { query: "  " }
    });
    assert.equal(out.kind, "result");
    assert.equal(out.status, 200);
    assert.equal(out.body.success, false);
    assert.equal(out.body.metadata.code, "provider");
  });

  it("create_subtask soft-fails when session has no owner", async () => {
    const svc = new ToolService({
      previewTools: {} as never,
      chatFeatureRepo: { getBySessionId: async () => null } as never,
      chatFeatureService: {} as never
    });
    const out = await svc.execute({
      sessionId: "missing",
      toolName: "create_subtask",
      args: { title: "x" }
    });
    assert.equal(out.status, 200);
    assert.equal(out.body.success, false);
  });

  it("create_subtask maps validation errors to soft failure", async () => {
    const svc = new ToolService({
      previewTools: {} as never,
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
    const out = await svc.execute({
      sessionId: "s1",
      toolName: "create_subtask",
      args: { title: "x" }
    });
    assert.equal(out.status, 200);
    assert.equal(out.body.success, false);
    assert.equal(out.body.output, "bad");
  });

  it("denies write_file when agentMode is ask", async () => {
    const svc = new ToolService({
      previewTools: {} as never,
      chatFeatureRepo: {} as never,
      chatFeatureService: {} as never
    });
    const out = await svc.execute({
      sessionId: "s",
      toolName: "write_file",
      args: { path: "a.ts", content: "x" },
      agentMode: "ask"
    });
    assert.equal(out.kind, "result");
    assert.equal(out.body.success, false);
    assert.match(String(out.body.output), /not available in ask mode/);
  });

  it("preview_stop requires name", async () => {
    const stop = mock.fn(async () => ({
      success: false,
      output: "name required (.forge/launch.json app name)"
    }));
    const svc = new ToolService({
      previewTools: { stop } as never,
      chatFeatureRepo: {} as never,
      chatFeatureService: {} as never
    });
    const out = await svc.execute({
      sessionId: "s1",
      toolName: "preview_stop",
      args: {}
    });
    assert.equal(out.status, 200);
    assert.equal(out.body.success, false);
  });
});
