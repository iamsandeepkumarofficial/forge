import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isToolInvocationInput } from "./taskLaunchPrep.js";

describe("isToolInvocationInput", () => {
  it("recognizes a tool envelope", () => {
    assert.equal(
      isToolInvocationInput({ toolName: "run_tests", args: {} }),
      true
    );
    assert.equal(isToolInvocationInput({ findings: "x" }), false);
  });
});
