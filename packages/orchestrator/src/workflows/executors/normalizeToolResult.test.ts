import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeRawToolResult } from "./normalizeToolResult.js";

describe("normalizeRawToolResult", () => {
  it("parses a JSON string and leaves prose alone", () => {
    assert.deepEqual(normalizeRawToolResult('{"ok":true}'), { ok: true });
    assert.equal(normalizeRawToolResult("plain"), "plain");
  });
});
