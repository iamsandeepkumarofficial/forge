import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decisionOf,
  isResumableExecutor,
  toolNeedsApproval,
  toolNameFromInput
} from "./types.js";
import { HumanExecutor } from "./human.js";

describe("executor types helpers", () => {
  it("parses decisions tool names and resumable check", () => {
    assert.equal(decisionOf({ decision: "skip" }), "skip");
    assert.equal(decisionOf({}), "approve");
    assert.equal(toolNameFromInput({ toolName: "list_files" }), "list_files");
    assert.equal(toolNeedsApproval("install_project_infra"), true);
    assert.equal(isResumableExecutor(new HumanExecutor()), true);
  });
});
