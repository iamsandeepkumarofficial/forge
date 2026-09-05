import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { factsRootForProject } from "./collectMemberFindings.js";

describe("collectMemberFindings", () => {
  it("factsRootForProject only analyzes local canonical paths", () => {
    assert.deepEqual(
      factsRootForProject({ source: "local", canonicalKey: "/repos/app" }),
      { path: "/repos/app", analyzable: true }
    );
    assert.deepEqual(
      factsRootForProject({ source: "github", canonicalKey: null }),
      { path: "", analyzable: false }
    );
  });
});
