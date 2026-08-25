import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("env bootstrap", () => {
  it("loads without throwing", async () => {
    await assert.doesNotReject(async () => {
      await import("./env.js");
    });
  });
});
