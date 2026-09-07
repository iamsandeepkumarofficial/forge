import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isTcpListening } from "./hostAppDb.js";

describe("hostAppDb", () => {
  it("isTcpListening returns false for closed port", async () => {
    assert.equal(await isTcpListening(1), false);
  });
});
