import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { finalizeHostWorkspace } from "./provisionHost.js";

describe("provisionHost", () => {
  it("rejects GitHub workspace members in host mode", async () => {
    await assert.rejects(
      () =>
        finalizeHostWorkspace({
          bindMounts: [],
          githubMemberCount: 1
        }),
      /GitHub workspace members/
    );
  });

  it("returns ready for local-only mounts", async () => {
    const r = await finalizeHostWorkspace({
      bindMounts: [],
      githubMemberCount: 0
    });
    assert.equal(r.status, "ready");
  });
});
