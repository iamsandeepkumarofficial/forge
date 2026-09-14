import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveLocalFolderPath } from "./provision.js";

describe("sessionSandbox provision", () => {
  it("resolveLocalFolderPath prefers explicit local_folder source", () => {
    assert.equal(
      resolveLocalFolderPath(
        {
          id: "p1",
          source: "github",
          canonicalKey: null
        } as never,
        { type: "local_folder", path: "/tmp/app" }
      ),
      "/tmp/app"
    );
  });

  it("resolveLocalFolderPath uses local project canonicalKey", () => {
    assert.equal(
      resolveLocalFolderPath({
        id: "p1",
        source: "local",
        canonicalKey: "/repos/demo"
      } as never),
      "/repos/demo"
    );
    assert.equal(
      resolveLocalFolderPath({
        id: "p1",
        source: "github",
        canonicalKey: null
      } as never),
      null
    );
  });
});
