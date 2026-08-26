import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pocAuth } from "./auth.js";

describe("pocAuth (internal no-op)", () => {
  it("always calls next", () => {
    const auth = pocAuth("ignored");
    let nextCalled = false;
    auth({} as never, {} as never, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  });
});
