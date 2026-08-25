import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePorcelain } from "./porcelain.js";
describe("parsePorcelain", () => {
  it("parses modified and untracked lines", () => {
    const out = parsePorcelain(" M src/a.ts\n?? new.txt");
    assert.equal(out.length, 2);
    assert.equal(out[0]!.path, "src/a.ts");
    assert.equal(out[0]!.kind, "modified");
    assert.equal(out[1]!.kind, "untracked");
  });
  it("handles rename arrow", () => {
    const out = parsePorcelain("R  old.ts -> new.ts");
    assert.equal(out[0]!.path, "new.ts");
    assert.equal(out[0]!.kind, "renamed");
  });
});
