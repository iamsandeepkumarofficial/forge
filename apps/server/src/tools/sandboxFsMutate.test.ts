import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { executeSandboxFsMutate } from "./sandboxFsMutate.js";

describe("sandboxFsMutate", () => {
  it("rejects empty write batches without touching the sandbox", async () => {
    const result = await executeSandboxFsMutate({
      toolName: "write_file",
      containerName: "unused",
      sessionId: "s1",
      args: { files: [] }
    });
    assert.equal(result?.success, false);
    assert.match(result?.output ?? "", /at least one file is required/);
  });

  it("returns null for non-mutating tools", async () => {
    assert.equal(
      await executeSandboxFsMutate({
        toolName: "read_file",
        containerName: "unused",
        sessionId: "s1",
        args: { path: "a.ts" }
      }),
      null
    );
  });
});
