import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { partitionMemberMounts } from "./provisionMounts.js";

describe("provisionMounts", () => {
  it("exports partitionMemberMounts", () => {
    assert.equal(typeof partitionMemberMounts, "function");
  });
});
