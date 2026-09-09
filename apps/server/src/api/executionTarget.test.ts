import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readExecutionTarget } from "./executionTarget.js";

describe("executionTarget", () => {
  it("defaults to local when body omits target", () => {
    assert.equal(readExecutionTarget({}), "local");
    assert.equal(readExecutionTarget(null), "local");
    assert.equal(readExecutionTarget({ executionTarget: "nope" }), "local");
  });

  it("parses cloud when provided", () => {
    assert.equal(readExecutionTarget({ executionTarget: "cloud" }), "cloud");
    assert.equal(readExecutionTarget({ executionTarget: "local" }), "local");
  });
});
