import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hostEnsurePublishedPortReady } from "./hostAdapterPorts.js";
import type { EnsurePublishedPortReadyInput } from "./types.js";

describe("hostAdapterPorts", () => {
  it("ensurePublishedPortReady probes TCP", async () => {
    const input: EnsurePublishedPortReadyInput = {
      handle: { sessionId: "s", ref: "/tmp", runtime: "host" },
      publishedPort: 59_998,
      listenPort: 59_998
    };
    const ok = await hostEnsurePublishedPortReady(input);
    assert.equal(typeof ok, "boolean");
  });
});
