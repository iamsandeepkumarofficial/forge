import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scrubHostEnv } from "./hostEnv.js";

describe("hostEnv", () => {
  it("allowlists env and sets TERM default", () => {
    const env = scrubHostEnv({ FORGE_TEST: "x" });
    assert.equal(env.FORGE_TEST, "x");
    assert.ok(env.TERM);
    assert.equal(env.DATABASE_URL, undefined);
  });
});
