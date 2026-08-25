import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  assertValidChatFeatureType,
  ChatFeatureService,
  ChatFeatureValidationError,
  SINGLE_LEVEL_PARENT_ERROR,
  VALID_TYPES
} from "./chatFeatureService.js";

describe("chatFeatureService", () => {
  it("assertValidChatFeatureType accepts presets and rejects others", () => {
    for (const type of VALID_TYPES) {
      assert.doesNotThrow(() => assertValidChatFeatureType(type));
    }
    assert.throws(
      () => assertValidChatFeatureType("epic"),
      (err: unknown) =>
        err instanceof ChatFeatureValidationError &&
        err.message.includes("Invalid type")
    );
  });

  it("assertSingleLevelParent rejects missing parents", async () => {
    const chatRepo = {
      getById: mock.fn(async () => null),
      countChildren: mock.fn(async () => 0)
    };
    const svc = new ChatFeatureService(chatRepo as never);
    await assert.rejects(
      () =>
        svc.assertSingleLevelParent({
          projectId: "p1",
          chatId: "c1",
          parentId: "missing"
        }),
      /Parent chat\/feature not found/
    );
  });

  it("assertSingleLevelParent enforces single-level rule", async () => {
    const chatRepo = {
      getById: mock.fn(async () => ({
        id: "parent",
        projectId: "p1",
        parentId: "grand"
      })),
      countChildren: mock.fn(async () => 0)
    };
    const svc = new ChatFeatureService(chatRepo as never);
    await assert.rejects(
      () =>
        svc.assertSingleLevelParent({
          projectId: "p1",
          chatId: "c1",
          parentId: "parent"
        }),
      (err: unknown) =>
        err instanceof ChatFeatureValidationError &&
        err.message === SINGLE_LEVEL_PARENT_ERROR
    );
  });

  it("create defaults type/priority and persists via repo", async () => {
    const created = {
      id: "cf1",
      title: "New Chat",
      type: "feature",
      priority: "medium"
    };
    const chatRepo = {
      getById: mock.fn(async () => null),
      createChatFeature: mock.fn(async (row: { title: string }) => ({
        ...created,
        ...row
      }))
    };
    const svc = new ChatFeatureService(chatRepo as never);
    const row = await svc.create({
      projectId: "p1",
      userId: "u1",
      title: "  Hello  "
    });
    assert.equal(row.title, "Hello");
    assert.equal(chatRepo.createChatFeature.mock.callCount(), 1);
    const arg = chatRepo.createChatFeature.mock.calls[0]!.arguments[0] as {
      type: string;
      priority: string;
      kind: string;
    };
    assert.equal(arg.type, "feature");
    assert.equal(arg.priority, "medium");
    assert.equal(arg.kind, "ticket");
  });

  it("createWorkbench writes workbench kind", async () => {
    const chatRepo = {
      createChatFeature: mock.fn(async (row: unknown) => row)
    };
    const svc = new ChatFeatureService(chatRepo as never);
    const row = (await svc.createWorkbench({
      projectId: "p1",
      userId: "u1",
      title: "WB"
    })) as { kind: string; title: string; parentId: null };
    assert.equal(row.kind, "workbench");
    assert.equal(row.title, "WB");
    assert.equal(row.parentId, null);
  });
});
