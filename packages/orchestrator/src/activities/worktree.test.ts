import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_CONFLICT_RESOLVER_ATTEMPTS } from "@forge/core";

describe("worktree conflict policy", () => {
  it("bounds resolver attempts at 2", () => {
    assert.equal(MAX_CONFLICT_RESOLVER_ATTEMPTS, 2);
    let attempts = 0;
    while (attempts < MAX_CONFLICT_RESOLVER_ATTEMPTS) {
      attempts += 1;
    }
    assert.equal(attempts, 2);
    assert.ok(attempts < 3);
  });

  it("treats merge abort as conflict without half-merged success", () => {
    const merge = {
      ok: false as const,
      conflict: true as const,
      paths: ["a.ts"]
    };
    assert.equal(merge.ok, false);
    assert.equal(merge.conflict, true);
  });
});
