import { describe, it, mock, before, afterEach } from "node:test";
import assert from "node:assert/strict";

describe("sessionActivity", () => {
  const updated: string[] = [];
  let touchSessionActivity: typeof import("./sessionActivity.js").touchSessionActivity;
  let resetSessionActivityTouches: typeof import("./sessionActivity.js").resetSessionActivityTouches;

  before(async () => {
    mock.module("../catalog/chatFeatureRepository.js", {
      exports: {
        ChatFeatureRepository: class {
          async getBySessionId(sessionId: string) {
            return sessionId === "s1" ? { id: "c1" } : null;
          }
          async updateLastActivity(id: string) {
            updated.push(id);
          }
        }
      }
    });
    ({ touchSessionActivity, resetSessionActivityTouches } = await import(
      "./sessionActivity.js"
    ));
  });

  afterEach(() => {
    updated.length = 0;
    resetSessionActivityTouches();
  });

  it("records activity and throttles repeats", async () => {
    const now = Date.parse("2026-08-30T18:00:00Z");
    assert.equal(await touchSessionActivity("s1", { now, force: true }), true);
    assert.equal(await touchSessionActivity("s1", { now }), false);
    assert.deepEqual(updated, ["c1"]);
  });

  it("skips unknown sessions", async () => {
    assert.equal(await touchSessionActivity("missing", { force: true }), false);
    assert.deepEqual(updated, []);
  });
});
