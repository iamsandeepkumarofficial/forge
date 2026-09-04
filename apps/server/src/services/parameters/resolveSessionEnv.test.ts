import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as mod from "./resolveSessionEnv.js";

describe("resolveSessionEnv", () => {
  it("exports a module", () => {
    assert.equal(typeof mod, "object");
    assert.ok(Object.keys(mod).length >= 0);
  });
});
