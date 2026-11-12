import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveTaskInput } from "./resolve-input.js";

describe("resolveTaskInput", () => {
  it("fans in dependency values by id", () => {
    const result = resolveTaskInput({
      dependencyIds: ["a"],
      dependencyValues: { a: { n: 1 } }
    });
    assert.deepEqual(result, { ok: true, input: { a: { n: 1 } } });
  });
});
