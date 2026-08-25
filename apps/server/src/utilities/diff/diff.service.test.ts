import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePorcelain } from "./diff.service.js";

describe("diff.service re-export", () => {
  it("parsePorcelain maps status lines into file changes", () => {
    const result = parsePorcelain(
      [" M src/a.ts", "?? new.txt", "D  gone.js"].join("\n")
    );
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 2);
    assert.ok(
      result.some((c) => c.path === "src/a.ts" || c.path.endsWith("a.ts"))
    );
    assert.ok(result.some((c) => c.path === "new.txt"));
  });

  it("parsePorcelain returns empty array for blank input", () => {
    assert.deepEqual(parsePorcelain(""), []);
    assert.deepEqual(parsePorcelain("\n"), []);
  });
});
