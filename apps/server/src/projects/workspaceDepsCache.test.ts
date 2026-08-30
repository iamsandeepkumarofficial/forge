import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DEPS_CACHE_MOUNT,
  workspaceDepsVolumeName,
  clearWorkspaceDepsCache
} from "./workspaceDepsCache.js";

describe("workspaceDepsCache", () => {
  it("names a stable docker volume per workspace id", () => {
    const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    assert.equal(
      workspaceDepsVolumeName(id),
      "forge-ws-deps-aaaaaaaabbbbccccddddeeeeeeeeeeee"
    );
    assert.equal(DEPS_CACHE_MOUNT, "/forge-ws-cache");
  });

  it("exports clearWorkspaceDepsCache", () => {
    assert.equal(typeof clearWorkspaceDepsCache, "function");
  });

  it("skips restore when node_modules is already the live cache link", () => {
    const src = readFileSync(
      fileURLToPath(new URL("./workspaceDepsCache.ts", import.meta.url)),
      "utf8"
    );
    assert.match(src, /already-linked/);
    assert.match(src, /already-present/);
    const rmAt = src.indexOf('rm -rf "${abs}/node_modules"');
    const skipAt = src.indexOf("already-linked");
    assert.ok(skipAt > 0 && skipAt < rmAt);
  });
});
