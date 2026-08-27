import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ChatFeatureService } from "../projects/chatFeatureService.js";
describe("ChatFeatureService workbench sessions", () => {
  it("createWorkbench sets kind workbench without parent or ticket defaults", async () => {
    const created: Array<Record<string, unknown>> = [];
    const repo = {
      createChatFeature: async (chat: Record<string, unknown>) => {
        created.push(chat);
        return { id: "wb-1", ...chat };
      }
    };
    const service = new ChatFeatureService(repo as never);
    const row = await service.createWorkbench({
      projectId: "p1",
      userId: "u1",
      title: "Manual spike"
    });
    assert.equal(row.kind, "workbench");
    assert.equal(created[0]?.kind, "workbench");
    assert.equal(created[0]?.parentId, null);
    assert.equal(created[0]?.title, "Manual spike");
    assert.match(String(created[0]?.branchName), /^workbench-/);
    assert.match(String(created[0]?.sessionId), /^workbench-/);
  });

  it("createWorkbench accepts workspaceId for workspace chats", async () => {
    const created: Array<Record<string, unknown>> = [];
    const repo = {
      createChatFeature: async (chat: Record<string, unknown>) => {
        created.push(chat);
        return { id: "wb-ws-1", ...chat };
      }
    };
    const service = new ChatFeatureService(repo as never);
    const row = await service.createWorkbench({
      workspaceId: "w1",
      userId: "u1",
      title: "Workspace chat"
    });
    assert.equal(row.kind, "workbench");
    assert.equal(created[0]?.workspaceId, "w1");
    assert.equal(created[0]?.projectId, null);
    assert.equal(created[0]?.kind, "workbench");
  });
});
