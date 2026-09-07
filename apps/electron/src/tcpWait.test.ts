import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isTcpOpen, waitForTcp } from "./tcpWait.js";

describe("tcpWait", () => {
  it("isTcpOpen returns false for closed port", async () => {
    const open = await isTcpOpen({
      host: "127.0.0.1",
      port: 1,
      timeoutMs: 200
    });
    assert.equal(open, false);
  });

  it("waitForTcp times out", async () => {
    await assert.rejects(
      () =>
        waitForTcp({
          host: "127.0.0.1",
          port: 1,
          attempts: 2,
          label: "test"
        }),
      /timed out waiting for test/
    );
  });
});
