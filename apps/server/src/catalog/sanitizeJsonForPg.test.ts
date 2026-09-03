import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeJsonForPg } from "./sanitizeJsonForPg.js";

describe("sanitizeJsonForPg", () => {
  it("strips null bytes from strings", () => {
    assert.equal(sanitizeJsonForPg("a\u0000b"), "ab");
  });

  it("recurses into objects and arrays", () => {
    const cleaned = sanitizeJsonForPg({
      text: "ok\u0000",
      nested: [{ out: "x\u0000y" }],
      n: 1,
      b: true,
      z: null
    });
    assert.deepEqual(cleaned, {
      text: "ok",
      nested: [{ out: "xy" }],
      n: 1,
      b: true,
      z: null
    });
  });

  it("leaves clean payloads unchanged", () => {
    const payload = { event: "delta", text: "hello" };
    assert.deepEqual(sanitizeJsonForPg(payload), payload);
  });
});
