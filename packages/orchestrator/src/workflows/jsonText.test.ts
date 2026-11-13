import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tryParseJsonObject } from "./jsonText.js";

describe("tryParseJsonObject", () => {
  it("parses a single JSON object and ignores other text", () => {
    assert.deepEqual(tryParseJsonObject(' {"a":1} '), { a: 1 });
    assert.equal(tryParseJsonObject("not json"), undefined);
    assert.equal(tryParseJsonObject("[1]"), undefined);
  });
});
