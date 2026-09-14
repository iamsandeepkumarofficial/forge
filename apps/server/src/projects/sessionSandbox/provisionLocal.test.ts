import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveLocalFolderPath } from "./provision.js";

describe("provisionLocal", () => {
  it("resolveLocalFolderPath prefers explicit local_folder source", () => {
    const path = resolveLocalFolderPath(
      {
        id: "p1",
        source: "github",
        canonicalKey: null
      } as never,
      { type: "local_folder", path: "/tmp/proj" }
    );
    assert.equal(path, "/tmp/proj");
  });
});
