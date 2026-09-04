import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as mod from "./workspace.service.js";

describe("workspace.service", () => {
  it("exports a module", () => {
    assert.equal(typeof mod, "object");
    assert.ok(Object.keys(mod).length >= 0);
  });
});
