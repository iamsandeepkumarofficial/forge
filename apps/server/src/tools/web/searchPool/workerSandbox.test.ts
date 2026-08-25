import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { workerContainerName } from "./workerSandbox.js";

describe("workerSandbox helpers", () => {
  it("workerContainerName is deterministic", () => {
    assert.equal(workerContainerName(0), "forge-websearch-0");
    assert.equal(workerContainerName(3), "forge-websearch-3");
  });
});
