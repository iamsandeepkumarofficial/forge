import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dockerExec } from "./sandboxExec.js";

describe("dockerExec sessionId guard", () => {
  it("rejects host filesystem refs without sessionId", async () => {
    await assert.rejects(
      () =>
        dockerExec({
          container: "/Users/me/.forge/sessions/x/workbench-1",
          argv: ["true"]
        }),
      /Missing sessionId for host workspace exec/
    );
  });
});
