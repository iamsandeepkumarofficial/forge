import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("replan copy-forward", () => {
  it("keeps completed task ids across versions", () => {
    const completed = new Set(["inspect"]);
    const next = ["inspect", "fix-deps", "implement"].map((id) => ({
      id,
      status: completed.has(id) ? "completed" : "pending"
    }));
    assert.equal(next.find((t) => t.id === "inspect")?.status, "completed");
    assert.equal(next.find((t) => t.id === "fix-deps")?.status, "pending");
  });
});
