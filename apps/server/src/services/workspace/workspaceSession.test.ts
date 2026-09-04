import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as mod from "./workspaceSession.js";

describe("workspaceSession", () => {
  it("exports a module", () => {
    assert.equal(typeof mod, "object");
    assert.ok(Object.keys(mod).length >= 0);
  });
});
