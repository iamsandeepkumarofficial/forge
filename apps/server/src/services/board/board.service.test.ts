import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { BoardService } from "./board.service.js";

describe("BoardService", () => {
  it("validateStatus and allowedStatuses cover board columns", () => {
    const board = new BoardService();
    assert.equal(board.validateStatus("planning"), true);
    assert.equal(board.validateStatus("development"), true);
    assert.equal(board.validateStatus("unknown"), false);
    const allowed = board.allowedStatuses();
    assert.ok(allowed.includes("qa"));
    assert.ok(allowed.includes("done"));
    assert.equal(allowed.length, 5);
  });

  it("updateCardStatus returns null for missing cards", async () => {
    const board = new BoardService();
    const repo = (
      board as unknown as {
        chatFeatureRepo: { getById: (id: string) => Promise<null> };
      }
    ).chatFeatureRepo;
    repo.getById = mock.fn(async () => null);
    assert.equal(await board.updateCardStatus("missing", "planning"), null);
  });

  it("addWorklog creates activity when card exists", async () => {
    const board = new BoardService();
    const deps = board as unknown as {
      chatFeatureRepo: {
        getById: (id: string) => Promise<{ id: string }>;
        updateLastActivity: (id: string) => Promise<void>;
      };
      activityRepo: {
        create: (row: unknown) => Promise<{ id: string; summary: string }>;
      };
    };
    deps.chatFeatureRepo.getById = mock.fn(async () => ({ id: "c1" }));
    deps.chatFeatureRepo.updateLastActivity = mock.fn(async () => undefined);
    deps.activityRepo.create = mock.fn(async () => ({
      id: "a1",
      summary: "did work"
    }));
    const created = await board.addWorklog("c1", {
      agentId: "agent-1",
      summary: "did work",
      detail: { step: 1 }
    });
    assert.equal(created?.id, "a1");
    assert.equal(deps.activityRepo.create.mock.callCount(), 1);
  });
});
