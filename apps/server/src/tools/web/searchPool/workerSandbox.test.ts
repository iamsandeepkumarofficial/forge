import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ensureWorker, workerContainerName } from "./workerSandbox.js";

describe("workerSandbox helpers", () => {
  it("workerContainerName is deterministic", () => {
    assert.equal(workerContainerName(0), "forge-websearch-0");
    assert.equal(workerContainerName(3), "forge-websearch-3");
  });

  it("ensureWorker returns host virtual worker", async () => {
    const w = await ensureWorker(0);
    assert.equal(w.containerName, "host-websearch-0");
    assert.equal(w.state, "ready");
  });
});
